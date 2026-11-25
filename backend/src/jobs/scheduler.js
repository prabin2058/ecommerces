import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import Product from "../models/Product.js";
import Cart from "../models/Cart.js";
import Variant from "../models/Variant.js";
import { cancelPendingOrder } from "../services/orderService.js";
import { reconcilePayment, gatewayFor } from "../services/paymentService.js";
import { publishIssues } from "../services/productAdminService.js";
import { notify, adminAlert, formatMoney } from "../services/notificationService.js";
import { invalidateCatalog } from "../lib/cache.js";
import config from "../config.js";

const running = new Set();
async function guarded(name, fn) {
  if (running.has(name)) return;
  running.add(name);
  try {
    return await fn();
  } catch (e) {
    console.error(`[job:${name}]`, e);
    await adminAlert(`Job ${name} failed`, e.message, { severity: "critical", dedupeKey: `job:${name}:${new Date().toISOString().slice(0, 13)}` }).catch(() => {});
  } finally {
    running.delete(name);
  }
}

/** Every minute: check stuck payments with the gateway, then expire reservations. */
export async function expireReservations() {
  const now = new Date();
  // Reconcile anything pending > 2 min first, so a late/lost webhook never cancels a paid order.
  const pending = await Order.find({ status: "pending_payment", createdAt: { $lt: new Date(now - 2 * 60_000) } }).limit(200);
  let reconciled = 0, expired = 0;
  for (const o of pending) {
    const pays = await Payment.find({ order: o._id, status: { $in: ["created", "pending"] } });
    for (const p of pays) if (await reconcilePayment(p)) reconciled++;
  }
  const due = await Order.find({ status: "pending_payment", reservationExpiresAt: { $lt: now } }).limit(200);
  for (const o of due) if (await cancelPendingOrder(o._id, { note: `Payment not completed within ${config.checkout.reservationMinutes} minutes` })) expired++;
  if (reconciled || expired) console.log(`[job:reservations] reconciled=${reconciled} expired=${expired}`);
  return { reconciled, expired };
}

export async function publishScheduled() {
  const due = await Product.find({ status: "draft", publishAt: { $ne: null, $lte: new Date() } });
  for (const p of due) {
    const issues = await publishIssues(p);
    if (issues.length) {
      await Product.updateOne({ _id: p._id }, { publishAt: null });
      await adminAlert(`Scheduled publish failed: ${p.name}`, issues.join("; "), { dedupeKey: `sched:${p._id}:${p.publishAt?.toISOString()}` });
      continue;
    }
    await Product.updateOne({ _id: p._id }, { status: "active", publishAt: null, publishedAt: new Date() });
    console.log(`[job:publish] ${p.slug} is live`);
  }
  if (due.length) invalidateCatalog();
}

/** Remind customers about carts left behind after 1h and 24h. */
export async function abandonedCarts() {
  const now = Date.now();
  const stages = [
    { n: 0, after: 60 * 60_000, subject: "You left something in your cart" },
    { n: 1, after: 24 * 60 * 60_000, subject: "Still thinking it over? Your cart is waiting" },
  ];
  for (const st of stages) {
    const carts = await Cart.find({
      status: "active", remindersSent: st.n, "items.0": { $exists: true },
      lastActivityAt: { $lt: new Date(now - st.after) },
      $or: [{ email: { $nin: [null, ""] } }, { user: { $ne: null } }],
    }).populate("user", "email name").limit(100);
    for (const c of carts) {
      const to = c.email || c.user?.email;
      if (!to) continue;
      // Not converted: no paid/confirmed order for this cart since last activity.
      const converted = await Order.exists({ cart: c._id, createdAt: { $gt: c.lastActivityAt }, status: { $nin: ["pending_payment", "cancelled"] } });
      if (converted) continue;
      await notify({
        channel: "email", to, template: "abandoned_cart", dedupeKey: `abandon:${c._id}:${st.n}:${c.lastActivityAt.getTime()}`,
        subject: st.subject, body: `You have ${c.items.reduce((s, i) => s + i.quantity, 0)} item(s) in your cart. Complete your order: ${config.appUrl}/cart`,
      });
      await Cart.updateOne({ _id: c._id, remindersSent: st.n }, { remindersSent: st.n + 1 });
    }
  }
}

/** Daily: compare paid orders with gateway settlements. */
export async function dailyReconciliation({ hours = 24 } = {}) {
  const to = new Date(), from = new Date(Date.now() - hours * 3600_000);
  const settlements = await gatewayFor().settlements({ from, to });
  const pays = await Payment.find({ gateway: "mock", status: { $in: ["succeeded", "refunded"] }, updatedAt: { $gte: from } }).populate("order", "orderNumber total paymentStatus status");
  const byRef = new Map(pays.map((p) => [p.gatewayRef, p]));
  const issues = [];
  for (const s of settlements) {
    const p = byRef.get(s.id);
    if (!p) issues.push(`Gateway settled ${s.id} (${formatMoney(s.amount)}, ref ${s.reference}) with no matching payment`);
    else if (p.amount !== s.amount) issues.push(`${s.reference}: amount mismatch ${formatMoney(p.amount)} vs ${formatMoney(s.amount)}`);
    else if (p.order && !["paid", "refunded", "partially_refunded", "refund_pending"].includes(p.order.paymentStatus)) issues.push(`${s.reference}: gateway says paid but order is ${p.order.paymentStatus}`);
    byRef.delete(s.id);
  }
  for (const p of byRef.values()) if (p.status === "succeeded") issues.push(`${p.order?.orderNumber}: marked paid but missing from gateway settlements`);
  // Stock sanity: negative or impossible values.
  const bad = await Variant.find({ $or: [{ reserved: { $lt: 0 } }, { $expr: { $gt: ["$reserved", "$onHand"] } }, { onHand: { $lt: 0 } }] }, { sku: 1, onHand: 1, reserved: 1 }).limit(50);
  for (const v of bad) issues.push(`Stock mismatch on ${v.sku}: on hand ${v.onHand}, reserved ${v.reserved}`);
  if (issues.length) await adminAlert("Reconciliation found issues", issues.join("\n"), { severity: "critical", dedupeKey: `recon:${to.toISOString().slice(0, 13)}` });
  return { checked: settlements.length, issues };
}

export function startJobs() {
  const minute = setInterval(() => {
    guarded("reservations", expireReservations);
    guarded("publish", publishScheduled);
    guarded("abandoned", abandonedCarts);
  }, 60_000);
  const daily = setInterval(() => guarded("reconcile", dailyReconciliation), 24 * 3600_000);
  minute.unref();
  daily.unref();
  setTimeout(() => guarded("reservations", expireReservations), 5_000).unref();
  console.log("[jobs] scheduler started");
}
