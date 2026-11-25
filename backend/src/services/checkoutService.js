import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import User from "../models/User.js";
import IdempotencyKey from "../models/IdempotencyKey.js";
import config from "../config.js";
import { quote } from "./pricingService.js";
import { findCart, setCartEmail, track } from "./cartService.js";
import { reserveLines, releaseOrderStock, markOrderPaid, cancelPendingOrder, publicOrder, commitOrderStock, finalizeCod } from "./orderService.js";
import { release } from "./inventoryService.js";
import { startPayment } from "./paymentService.js";
import { EMAIL_REGEX, PHONE_REGEX } from "../constants/regex.js";
import { badRequest, conflict, validation } from "../lib/errors.js";
import { orderNumber, randomToken, requestAppUrl } from "../lib/util.js";

const ADDRESS_FIELDS = ["fullName", "phone", "line1", "line2", "city", "province", "postalCode", "country"];

export function validateAddress(a, prefix = "") {
  const e = {};
  if (!a || typeof a !== "object") return { [`${prefix}address`]: "Address is required" };
  if (!a.fullName?.trim()) e[`${prefix}fullName`] = "Full name is required";
  if (!a.line1?.trim()) e[`${prefix}line1`] = "Street address is required";
  if (!a.city?.trim()) e[`${prefix}city`] = "City is required";
  if (!a.phone?.trim()) e[`${prefix}phone`] = "Phone is required";
  else if (!PHONE_REGEX.test(a.phone.replace(/\s/g, ""))) e[`${prefix}phone`] = "Enter a valid Nepali phone number (e.g. 98XXXXXXXX)";
  return e;
}

const cleanAddress = (a) => Object.fromEntries(ADDRESS_FIELDS.map((k) => [k, String(a?.[k] ?? "").trim().slice(0, 200)]).filter(([, v]) => v));

export async function shippingRates(req, address) {
  const cart = await findCart(req);
  const q = await quote({ items: cart?.items || [], couponCode: cart?.couponCode, address });
  return { methods: q.shippingMethods, isEstimate: !address?.city };
}

/**
 * Re-price and re-check stock. `expected` is what the customer is looking at:
 * { total, lines: [{ variantId, unitPrice, quantity }] } — anything different is reported as a change.
 */
export async function validateCheckout(req, { address, shippingMethod, expected }) {
  const cart = await findCart(req);
  if (!cart || !cart.items.length) throw badRequest("CART_EMPTY", "Your cart is empty");
  // Price-changed lines are checked against what the customer saw on the review step, not when added.
  const q = await quote({ items: cart.items, couponCode: cart.couponCode, address, shippingMethod });
  const changes = [];
  if (expected) {
    const exp = new Map((expected.lines || []).map((l) => [String(l.variantId), l]));
    for (const l of q.lines) {
      const e = exp.get(l.variantId);
      if (!e) changes.push({ type: "added", name: l.name, message: `${l.name} was added to your cart` });
      else if (e.unitPrice !== l.unitPrice) changes.push({ type: "price", name: l.name, previous: e.unitPrice, current: l.unitPrice, message: `${l.name} changed price` });
      else if (e.quantity !== l.quantity) changes.push({ type: "quantity", name: l.name, message: `${l.name} quantity changed` });
      exp.delete(l.variantId);
    }
    for (const e of exp.values()) changes.push({ type: "removed", message: "An item was removed from your cart" });
    if (expected.total !== undefined && expected.total !== q.total && !changes.length)
      changes.push({ type: "total", previous: expected.total, current: q.total, message: "Your order total changed (shipping, tax or coupon)" });
  }
  if (q.coupon?.error) changes.push({ type: "coupon", message: q.coupon.error });
  const blocking = q.lines.filter((l) => l.blocking && !l.issues.every((i) => i.code === "PRICE_CHANGED"));
  return { quote: q, changes, ok: !changes.length && !blocking.length && !q.issues.length && q.lines.length > 0, cart };
}

export async function placeOrder(req, res, idempotencyKey, body) {
  if (!idempotencyKey || !/^[\w-]{16,100}$/.test(idempotencyKey)) throw badRequest("IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key header is required");

  // 1. Same key -> same order (double click, network retry). Never a second order or charge.
  const existing = await Order.findOne({ idempotencyKey });
  if (existing) return respondWithOrder(existing, { replay: true });
  try {
    await IdempotencyKey.create({ key: idempotencyKey });
  } catch (e) {
    if (e.code !== 11000) throw e;
    // Another request with this key is in flight: wait for its order.
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 150));
      const o = await Order.findOne({ idempotencyKey });
      if (o) return respondWithOrder(o, { replay: true });
      if (!(await IdempotencyKey.exists({ key: idempotencyKey }))) break; // first attempt failed
    }
    throw conflict("REQUEST_IN_PROGRESS", "Your order is still being processed. Please wait a moment.");
  }
  try {
    return await placeOrderOnce(req, res, idempotencyKey, body);
  } catch (e) {
    // Failed before an order existed: free the key so the customer can retry.
    if (!(await Order.exists({ idempotencyKey }))) await IdempotencyKey.deleteOne({ key: idempotencyKey });
    throw e;
  }
}

async function placeOrderOnce(req, res, idempotencyKey, body) {

  const { contact = {}, shippingAddress, billingAddress, billingSameAsShipping = true, shippingMethod, paymentMethod, acceptTerms, expected, notes } = body || {};
  const errors = {};
  const email = String(contact.email || req.user?.email || "").toLowerCase().trim();
  if (!EMAIL_REGEX.test(email)) errors.email = "Enter a valid email";
  const phone = String(contact.phone || shippingAddress?.phone || "").replace(/\s/g, "");
  if (!PHONE_REGEX.test(phone)) errors.phone = "Enter a valid phone number";
  Object.assign(errors, validateAddress(shippingAddress, "shipping."));
  if (!billingSameAsShipping) Object.assign(errors, validateAddress(billingAddress, "billing."));
  if (!["card", "wallet", "bank", "cod"].includes(paymentMethod)) errors.paymentMethod = "Choose a payment method";
  if (!acceptTerms) errors.acceptTerms = "Please accept the terms to continue";
  if (Object.keys(errors).length) throw validation(errors);

  // 2. Re-price from the DB and compare with what the customer reviewed.
  const { quote: q, changes, ok, cart } = await validateCheckout(req, { address: shippingAddress, shippingMethod, expected });
  if (!ok) throw conflict(changes.length ? "CHECKOUT_CHANGED" : "CART_INVALID", changes.length ? "Your cart changed — please review before paying." : "Some items in your cart need attention.", { changes, quote: q });
  if (paymentMethod === "cod" && q.total > 5000000) throw badRequest("COD_LIMIT", "Cash on delivery is available for orders up to Rs 50,000");

  await setCartEmail(cart, email);

  // A new order for this cart supersedes any earlier unpaid one (frees its reservation).
  const stale = await Order.find({ cart: cart._id, status: "pending_payment", idempotencyKey: { $ne: idempotencyKey } });
  for (const o of stale) await cancelPendingOrder(o._id, { actor: "system", note: "Superseded by a new checkout" });

  // 3. Reserve stock atomically (conditional update per line, rollback on failure).
  const number = orderNumber();
  const r = await reserveLines(q.lines, number);
  if (!r.ok) {
    throw conflict("INSUFFICIENT_STOCK", `${r.failed.name} just sold out or has fewer units left. Please update your cart.`, { variantId: r.failed.variantId, available: r.failed.available });
  }

  // 4. Create the order with a snapshot of each line (never changes after this).
  let order;
  try {
    order = await Order.create({
      orderNumber: number, accessToken: randomToken(18), user: req.user?.id || null, cart: cart._id, email, phone,
      status: "pending_payment", paymentStatus: "unpaid", paymentMethod,
      items: q.lines.map((l) => ({
        variant: l.variantId, product: l.productId, productName: l.name, productSlug: l.slug, variantLabel: l.options, sku: l.sku, image: l.image,
        unitPrice: l.unitPrice, quantity: l.quantity, lineTotal: l.lineTotal, taxClass: l.taxClass, reservedQty: l.quantity, backordered: !!l.backorder,
      })),
      subtotal: q.subtotal, discount: q.discount, couponCode: q.coupon && !q.coupon.error ? q.coupon.code : undefined,
      shippingFee: q.shippingFee, shippingMethod: q.shippingMethod, tax: q.tax, total: q.total, currency: q.currency,
      shippingAddress: cleanAddress({ ...shippingAddress, phone: shippingAddress.phone || phone }),
      billingAddress: cleanAddress(billingSameAsShipping ? shippingAddress : billingAddress),
      notes: notes ? String(notes).slice(0, 500) : undefined,
      idempotencyKey,
      reservationExpiresAt: new Date(Date.now() + config.checkout.reservationMinutes * 60_000),
      stockState: "reserved",
      statusHistory: [{ status: "pending_payment", at: new Date(), actor: req.user?.name || email }],
    });
  } catch (e) {
    // Concurrent request with the same key won the race: undo our reservation, return theirs.
    for (const l of q.lines) await release(l.variantId, l.quantity, { orderId: number });
    if (e.code === 11000) {
      const winner = await Order.findOne({ idempotencyKey });
      if (winner) return respondWithOrder(winner, { replay: true });
    }
    throw e;
  }
  track(req, "order_placed", { value: order.total });

  // Save the address for logged-in customers.
  if (req.user?.id && body.saveAddress) {
    const u = await User.findById(req.user.id);
    const a = cleanAddress(shippingAddress);
    if (u && !u.addresses.some((x) => x.line1 === a.line1 && x.city === a.city)) {
      u.addresses.push({ ...a, isDefault: !u.addresses.length });
      await u.save();
    }
  }

  // 5. Cash on delivery confirms right away; online methods go to the gateway.
  if (paymentMethod === "cod") {
    const confirmed = await Order.findOneAndUpdate(
      { _id: order._id, status: "pending_payment" },
      { status: "confirmed", $push: { statusHistory: { status: "confirmed", at: new Date(), actor: "system", note: "Cash on delivery" } } },
      { new: true }
    );
    // reuse the paid path for stock + side effects, but keep payment unpaid
    await commitForCod(confirmed);
    return respondWithOrder(await Order.findById(order._id));
  }
  try {
    await startPayment(order, { method: paymentMethod, appUrl: requestAppUrl(req, config.appUrl) });
  } catch (e) {
    await cancelPendingOrder(order._id, { note: "Could not start payment" });
    throw e;
  }
  return respondWithOrder(order);
}

async function commitForCod(order) {
  await commitOrderStock(order);
  await finalizeCod(order);
}

async function respondWithOrder(order, { replay = false } = {}) {
  let payment = null;
  if (order.status === "pending_payment") {
    payment = await Payment.findOne({ order: order._id, status: { $in: ["created", "pending"] } }).sort({ createdAt: -1 });
  }
  return {
    replay,
    order: publicOrder(order, { includeToken: true }),
    payment: payment ? { id: String(payment._id), status: payment.status, redirectUrl: payment.redirectUrl, method: payment.method } : null,
    nextAction: order.status === "pending_payment" && payment ? "redirect" : "confirmation",
  };
}

export { releaseOrderStock, markOrderPaid };
