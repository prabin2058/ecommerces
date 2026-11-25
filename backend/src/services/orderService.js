import Order from "../models/Order.js";
import Cart from "../models/Cart.js";
import Coupon from "../models/Coupon.js";
import Payment from "../models/Payment.js";
import Product from "../models/Product.js";
import config from "../config.js";
import * as inventory from "./inventoryService.js";
import { notify, adminAlert, formatMoney } from "./notificationService.js";
import Event from "../models/Event.js";
import { conflict, badRequest, notFound } from "../lib/errors.js";
import { invalidateCatalog } from "../lib/cache.js";

const hist = (status, actor, note) => ({ status, at: new Date(), actor, note });

export function publicOrder(o, { includeToken = false } = {}) {
  const obj = o.toObject ? o.toObject() : o;
  return {
    id: String(obj._id), orderNumber: obj.orderNumber, status: obj.status, paymentStatus: obj.paymentStatus, paymentMethod: obj.paymentMethod,
    email: obj.email, phone: obj.phone,
    items: obj.items.map((i) => ({ productName: i.productName, productSlug: i.productSlug, variantLabel: i.variantLabel, sku: i.sku, image: i.image, unitPrice: i.unitPrice, quantity: i.quantity, lineTotal: i.lineTotal, backordered: i.backordered })),
    subtotal: obj.subtotal, discount: obj.discount, couponCode: obj.couponCode, shippingFee: obj.shippingFee, shippingMethod: obj.shippingMethod,
    tax: obj.tax, total: obj.total, currency: obj.currency, shippingAddress: obj.shippingAddress, billingAddress: obj.billingAddress,
    reservationExpiresAt: obj.status === "pending_payment" ? obj.reservationExpiresAt : null,
    trackingNumber: obj.trackingNumber, carrier: obj.carrier,
    statusHistory: (obj.statusHistory || []).map(({ status, at, note }) => ({ status, at, note })),
    createdAt: obj.createdAt, isGuest: !obj.user,
    ...(includeToken ? { accessToken: obj.accessToken } : {}),
  };
}

export const trackingUrl = (o) => `${config.appUrl}/orders/${o.orderNumber}?t=${o.accessToken}`;

// Reserve every line atomically; on any failure roll back what was reserved.
export async function reserveLines(lines, orderRef) {
  const done = [];
  for (const l of lines) {
    const v = await inventory.reserve(l.variantId, l.quantity, { allowBackorder: l.allowBackorder, orderId: orderRef });
    if (!v) {
      for (const d of done) await inventory.release(d.variantId, d.quantity, { orderId: orderRef });
      return { ok: false, failed: l };
    }
    done.push(l);
  }
  return { ok: true };
}

export async function releaseOrderStock(order, reason = "release") {
  const res = await Order.findOneAndUpdate({ _id: order._id, stockState: "reserved" }, { stockState: "released" }, { new: true });
  if (!res) return false; // already released/committed — idempotent
  for (const it of order.items) await inventory.release(it.variant, it.reservedQty || it.quantity, { orderId: order.orderNumber, reason });
  invalidateCatalog();
  return true;
}

export async function commitOrderStock(order) {
  const res = await Order.findOneAndUpdate({ _id: order._id, stockState: "reserved" }, { stockState: "committed" }, { new: true });
  if (!res) return true;
  for (const it of order.items) {
    const ok = await inventory.commitReserved(it.variant, it.reservedQty || it.quantity, { orderId: order.orderNumber });
    if (!ok) await inventory.sellDirect(it.variant, it.quantity, { orderId: order.orderNumber, allowBackorder: true });
  }
  invalidateCatalog();
  return true;
}

// Reservation was already released (expired) but money arrived: try to sell from free stock.
async function sellWithoutReservation(order) {
  const sold = [];
  for (const it of order.items) {
    const p = await Product.findById(it.product, { allowBackorder: 1 });
    const ok = await inventory.sellDirect(it.variant, it.quantity, { orderId: order.orderNumber, allowBackorder: !!p?.allowBackorder });
    if (!ok) {
      for (const s of sold) await inventory.restock(s.variant, s.quantity, { orderId: order.orderNumber, reason: "cancel" });
      return false;
    }
    sold.push(it);
  }
  await Order.updateOne({ _id: order._id }, { stockState: "committed" });
  invalidateCatalog();
  return true;
}

export async function finalizeCod(order) {
  return finalizeOrder(order);
}

// Side effects after an order becomes paid/confirmed. Each step is guarded so re-runs are no-ops.
async function finalizeOrder(order) {
  if (order.cart) {
    await Cart.updateOne({ _id: order.cart }, { items: [], couponCode: null, lastActivityAt: new Date() });
  }
  if (order.couponCode) {
    const marked = await Order.findOneAndUpdate({ _id: order._id, couponCounted: false }, { couponCounted: true });
    if (marked) await Coupon.updateOne({ code: order.couponCode }, { $inc: { usedCount: 1 } });
  }
  const first = await Order.findOneAndUpdate({ _id: order._id, confirmationSent: false }, { confirmationSent: true });
  if (first) {
    const lines = order.items.map((i) => `${i.quantity} × ${i.productName} (${i.variantLabel}) — ${formatMoney(i.lineTotal)}`).join("\n");
    await notify({
      channel: "email", to: order.email, template: "order_confirmation", dedupeKey: `confirm:${order._id}`,
      subject: `Order ${order.orderNumber} confirmed`,
      body: `Thanks for your order!\n\n${lines}\n\nTotal: ${formatMoney(order.total)}\nTrack your order: ${trackingUrl(order)}${order.user ? "" : `\n\nCreate an account with ${order.email} to see all your orders in one place: ${config.appUrl}/auth/register?email=${encodeURIComponent(order.email)}`}`,
    });
    await notify({ channel: "sms", to: order.phone, template: "order_confirmation_sms", dedupeKey: `confirm-sms:${order._id}`, subject: `Order ${order.orderNumber} confirmed. Total ${formatMoney(order.total)}.` });
    await adminAlert(`New order ${order.orderNumber}`, `${formatMoney(order.total)} · ${order.paymentMethod.toUpperCase()} · ${order.email}`, { severity: "info", dedupeKey: `neworder:${order._id}`, meta: { orderId: order._id } });
    Event.create({ type: "order_paid", visitor: order.user ? String(order.user) : order.email, value: order.total }).catch(() => {});
  }
}

/** Gateway confirmed payment. Idempotent: calling twice changes nothing the second time. */
export async function markOrderPaid(orderId, { actor = "gateway", payment } = {}) {
  let order = await Order.findOneAndUpdate(
    { _id: orderId, status: "pending_payment" },
    { status: "paid", paymentStatus: "paid", $push: { statusHistory: hist("paid", actor, payment ? `Payment ${payment.gatewayRef}` : undefined) } },
    { new: true }
  );
  if (order) {
    await commitOrderStock(order);
    await finalizeOrder(order);
    return { order, transitioned: true };
  }
  order = await Order.findById(orderId);
  if (!order) throw notFound("Order not found");
  if (order.paymentStatus === "paid") return { order, transitioned: false };
  if (order.status === "cancelled" && order.paymentStatus === "unpaid") {
    // Rare race: reservation expired, then payment arrived.
    const okStock = order.stockState === "reserved" ? (await commitOrderStock(order), true) : await sellWithoutReservation(order);
    if (okStock) {
      order = await Order.findOneAndUpdate(
        { _id: orderId, status: "cancelled", paymentStatus: "unpaid" },
        { status: "paid", paymentStatus: "paid", $addToSet: { flags: "paid_after_expiry" }, $push: { statusHistory: hist("paid", actor, "Payment arrived after reservation expired; stock was still available") } },
        { new: true }
      );
      if (order) await finalizeOrder(order);
      return { order: order || (await Order.findById(orderId)), transitioned: !!order };
    }
    // Business rule: auto-refund + critical admin alert.
    const { refundPayment } = await import("./paymentService.js");
    const refunded = payment ? await refundPayment(payment, { reason: "Paid but stock unavailable" }) : false;
    order = await Order.findOneAndUpdate(
      { _id: orderId },
      {
        status: refunded ? "refunded" : "cancelled", paymentStatus: refunded ? "refunded" : "refund_pending",
        $addToSet: { flags: refunded ? "paid_without_stock" : "refund_failed" },
        $push: { statusHistory: hist(refunded ? "refunded" : "cancelled", "system", "Paid after reservation expired and stock ran out — automatic refund") },
      },
      { new: true }
    );
    await adminAlert(`Paid order without stock: ${order.orderNumber}`, refunded ? "Customer was refunded automatically." : "Automatic refund FAILED — refund manually.", { severity: "critical", dedupeKey: `nostock:${order._id}`, meta: { orderId: order._id } });
    await notify({ channel: "email", to: order.email, template: "order_refunded", dedupeKey: `nostock-email:${order._id}`, subject: `Order ${order.orderNumber}: we're sorry`, body: `An item sold out before your payment completed. ${refunded ? "You have been refunded in full." : "We will refund you shortly."}` });
    return { order, transitioned: false };
  }
  return { order, transitioned: false };
}

/** Expire / cancel an unpaid order and release its reservation. Idempotent. */
export async function cancelPendingOrder(orderId, { actor = "system", note = "Payment not completed in time" } = {}) {
  const order = await Order.findOneAndUpdate(
    { _id: orderId, status: "pending_payment" },
    { status: "cancelled", $push: { statusHistory: hist("cancelled", actor, note) } },
    { new: true }
  );
  if (!order) return null;
  await releaseOrderStock(order);
  await Payment.updateMany({ order: order._id, status: { $in: ["created", "pending"] } }, { status: "cancelled" });
  return order;
}

// ---- Admin transitions ----
const TRANSITIONS = {
  pending_payment: ["cancelled"],
  paid: ["processing", "cancelled", "refunded"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled", "refunded"],
  shipped: ["delivered", "returned"],
  delivered: ["returned", "refunded"],
  returned: ["refunded"],
  cancelled: [],
  refunded: [],
};
export const allowedTransitions = (status) => TRANSITIONS[status] || [];

export async function adminUpdateStatus(orderId, { status, note, trackingNumber, carrier, restock = true }, user) {
  const order = await Order.findById(orderId);
  if (!order) throw notFound("Order not found");
  if (!allowedTransitions(order.status).includes(status))
    throw badRequest("INVALID_TRANSITION", `Cannot move an order from ${order.status} to ${status}`, { allowed: allowedTransitions(order.status) });
  const actor = user?.name || user?.email || "admin";
  if (order.status === "pending_payment" && status === "cancelled") {
    await cancelPendingOrder(order._id, { actor, note: note || "Cancelled by staff" });
    return Order.findById(order._id);
  }
  if (status === "shipped" && !trackingNumber && !order.trackingNumber) throw badRequest("TRACKING_REQUIRED", "Add a tracking number to mark as shipped");

  const update = { status, $push: { statusHistory: hist(status, actor, note) } };
  if (trackingNumber) update.trackingNumber = trackingNumber;
  if (carrier) update.carrier = carrier;

  const { refundPayment } = await import("./paymentService.js");
  if (status === "refunded" || (status === "cancelled" && order.paymentStatus === "paid")) {
    const pay = await Payment.findOne({ order: order._id, status: "succeeded" }).sort({ createdAt: -1 });
    if (pay) {
      const ok = await refundPayment(pay, { reason: note || status });
      if (!ok) throw conflict("REFUND_FAILED", "The gateway refund failed; try again or refund manually");
    }
    update.paymentStatus = order.paymentStatus === "paid" || pay ? "refunded" : order.paymentStatus;
  }
  if (status === "delivered" && order.paymentMethod === "cod") {
    update.paymentStatus = "paid";
    await Payment.create({ order: order._id, gateway: "cod", gatewayRef: `cod_${order.orderNumber}`, amount: order.total, status: "succeeded", method: "cod" });
  }
  const updated = await Order.findOneAndUpdate({ _id: order._id, status: order.status }, update, { new: true });
  if (!updated) throw conflict("CONCURRENT_UPDATE", "The order was changed by someone else — reload and try again");

  // Stock: cancelled/refunded/returned after stock was committed goes back on the shelf.
  if (["cancelled", "refunded", "returned"].includes(status) && restock && updated.stockState === "committed") {
    const mark = await Order.findOneAndUpdate({ _id: order._id, stockState: "committed" }, { stockState: "released" });
    if (mark) for (const it of order.items) await inventory.restock(it.variant, it.quantity, { orderId: order.orderNumber, reason: status === "returned" ? "return" : "cancel", user });
    invalidateCatalog();
  }
  const subjects = { shipped: "has shipped", delivered: "was delivered", cancelled: "was cancelled", refunded: "was refunded", processing: "is being prepared" };
  if (subjects[status])
    await notify({
      channel: "email", to: updated.email, template: `order_${status}`, dedupeKey: `status:${updated._id}:${status}`,
      subject: `Order ${updated.orderNumber} ${subjects[status]}`,
      body: `${status === "shipped" ? `Tracking: ${updated.carrier || ""} ${updated.trackingNumber}\n` : ""}${trackingUrl(updated)}`,
    });
  return updated;
}
