import Payment from "../models/Payment.js";
import Order from "../models/Order.js";
import WebhookEvent from "../models/WebhookEvent.js";
import config from "../config.js";
import mockGateway from "../gateway/mockGateway.js";
import { hmac, safeEqual } from "../lib/util.js";
import { markOrderPaid } from "./orderService.js";
import { adminAlert } from "./notificationService.js";
import { badRequest, conflict, unauthorized } from "../lib/errors.js";

const gateways = { mock: mockGateway };
export const gatewayFor = () => gateways.mock;

/** Create (or reuse) a gateway session for an order. Idempotent per order + attempt. */
export async function startPayment(order, { method, newAttempt = false, appUrl = config.appUrl } = {}) {
  if (order.status !== "pending_payment") throw conflict("ORDER_NOT_PAYABLE", `This order is ${order.status.replace("_", " ")}`);
  method = method || order.paymentMethod;
  if (!["card", "wallet", "bank"].includes(method)) throw badRequest("INVALID_METHOD", "Choose a payment method");
  const open = await Payment.findOne({ order: order._id, status: { $in: ["created", "pending"] } }).sort({ createdAt: -1 });
  if (open && !newAttempt && open.method === method) return open;
  if (open) await Payment.updateOne({ _id: open._id }, { status: "cancelled" });
  const attempt = (await Payment.countDocuments({ order: order._id })) + 1;
  const idempotencyKey = `${order._id}:${attempt}`;
  const gw = gatewayFor();
  const session = await gw.createSession({
    amount: order.total, currency: order.currency, reference: order.orderNumber, idempotencyKey, method,
    description: `Order ${order.orderNumber}`,
    returnUrl: `${appUrl}/checkout/return?order=${order.orderNumber}&t=${order.accessToken}`,
  });
  if (method !== order.paymentMethod) await Order.updateOne({ _id: order._id }, { paymentMethod: method });
  try {
    return await Payment.create({ order: order._id, gateway: gw.name, gatewayRef: session.id, idempotencyKey, method, amount: order.total, currency: order.currency, status: "pending", redirectUrl: session.url });
  } catch (e) {
    if (e.code === 11000) return Payment.findOne({ idempotencyKey });
    throw e;
  }
}

export async function refundPayment(payment, { reason } = {}) {
  if (payment.gateway === "cod") {
    await Payment.updateOne({ _id: payment._id }, { status: "refunded", refundedAmount: payment.amount });
    return true;
  }
  const r = await gatewayFor().refund(payment.gatewayRef, payment.amount - (payment.refundedAmount || 0));
  if (!r.ok) return false;
  await Payment.updateOne({ _id: payment._id }, { status: "refunded", $inc: { refundedAmount: r.amount }, $set: { "raw.refund": { ...r, reason } } });
  return true;
}

/** Verify `t=<unix>,v1=<hmac>` over `${t}.${rawBody}`; reject stale timestamps (replays). */
export function verifySignature(rawBody, header) {
  const parts = Object.fromEntries(String(header || "").split(",").map((kv) => kv.split("=").map((s) => s.trim())));
  const t = Number(parts.t);
  if (!t || !parts.v1) throw unauthorized("Missing signature");
  if (Math.abs(Date.now() / 1000 - t) > 300) throw unauthorized("Stale webhook timestamp");
  if (!safeEqual(parts.v1, hmac(config.webhookSecret, `${t}.${rawBody}`))) throw unauthorized("Invalid signature");
}

async function applyGatewayState(payment, state) {
  if (state.status === "succeeded") {
    await Payment.updateOne({ _id: payment._id, status: { $ne: "refunded" } }, { status: "succeeded", raw: state });
    return markOrderPaid(payment.order, { actor: "gateway", payment });
  }
  if (state.status === "failed") {
    await Payment.updateOne({ _id: payment._id, status: { $in: ["created", "pending"] } }, { status: "failed", failureReason: state.failureReason, raw: state });
  }
  if (state.status === "cancelled") {
    await Payment.updateOne({ _id: payment._id, status: { $in: ["created", "pending"] } }, { status: "cancelled", raw: state });
  }
  return null;
}

export async function handleWebhook(gateway, rawBody, signature) {
  if (gateway !== "mock") throw badRequest("UNKNOWN_GATEWAY", "Unknown gateway");
  verifySignature(rawBody, signature);
  const event = JSON.parse(rawBody);
  try {
    await WebhookEvent.create({ gateway, eventId: event.id, type: event.type, payload: event });
  } catch (e) {
    if (e.code === 11000) return { duplicate: true }; // already processed
    throw e;
  }
  const payment = await Payment.findOne({ gateway, gatewayRef: event.data?.sessionId });
  if (!payment) {
    await WebhookEvent.updateOne({ eventId: event.id }, { result: "unknown_payment" });
    await adminAlert("Webhook for unknown payment", `Event ${event.id} references ${event.data?.sessionId}`, { dedupeKey: `wh-unknown:${event.id}` });
    return { ignored: true };
  }
  if (event.data.amount !== payment.amount) {
    await adminAlert("Webhook amount mismatch", `${event.id}: expected ${payment.amount}, got ${event.data.amount}`, { severity: "critical", dedupeKey: `wh-amount:${event.id}` });
    return { ignored: true };
  }
  const statusMap = { "payment.succeeded": "succeeded", "payment.failed": "failed", "payment.cancelled": "cancelled" };
  await applyGatewayState(payment, { ...event.data, status: statusMap[event.type] || event.data.status });
  await WebhookEvent.updateOne({ eventId: event.id }, { result: "processed" });
  return { ok: true };
}

/** Ask the gateway directly — used by jobs when a webhook is late or lost. */
export async function reconcilePayment(payment) {
  const state = await gatewayFor().retrieve(payment.gatewayRef);
  if (!state) return null;
  if (state.status === "open") return null;
  return applyGatewayState(payment, state);
}
