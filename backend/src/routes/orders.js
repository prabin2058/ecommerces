import express from "express";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import { ah, notFound, forbidden } from "../lib/errors.js";
import { optionalAuth, hasRole } from "../middlewares/auth.js";
import { safeEqual, requestAppUrl } from "../lib/util.js";
import config from "../config.js";
import rateLimit from "../lib/rateLimit.js";
import { publicOrder, cancelPendingOrder } from "../services/orderService.js";
import { startPayment, reconcilePayment } from "../services/paymentService.js";

const router = express.Router();
router.use(optionalAuth);
router.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

// Access: the owner, staff, or anyone holding the order's tracking token (guest link).
async function loadOrder(req) {
  const o = await Order.findOne({ orderNumber: req.params.orderNumber });
  if (!o) throw notFound("Order not found");
  const token = req.query.t || req.body?.t;
  const owner = req.user && o.user && String(o.user) === String(req.user.id);
  if (!owner && !hasRole(req.user, "CATALOG_MANAGER") && !(token && safeEqual(token, o.accessToken))) throw notFound("Order not found");
  return o;
}

router.get("/:orderNumber", rateLimit({ key: "order-view", max: 120 }), ah(async (req, res) => {
  let o = await loadOrder(req);
  // Returning from the gateway: if the webhook hasn't landed yet, ask the gateway (never trust the redirect alone).
  if (o.status === "pending_payment" && req.query.sync === "1") {
    const p = await Payment.findOne({ order: o._id, status: { $in: ["created", "pending"] } }).sort({ createdAt: -1 });
    if (p) {
      await reconcilePayment(p);
      o = await Order.findById(o._id);
    }
  }
  const last = await Payment.findOne({ order: o._id }).sort({ createdAt: -1 });
  res.json({
    ...publicOrder(o, { includeToken: true }),
    lastPayment: last ? { status: last.status, method: last.method, failureReason: last.failureReason, redirectUrl: ["created", "pending"].includes(last.status) ? last.redirectUrl : null } : null,
  });
}));

router.post("/:orderNumber/pay", rateLimit({ key: "order-pay", max: 10 }), ah(async (req, res) => {
  const o = await loadOrder(req);
  const p = await startPayment(o, { method: req.body?.method, newAttempt: true, appUrl: requestAppUrl(req, config.appUrl) });
  res.json({ redirectUrl: p.redirectUrl });
}));

router.post("/:orderNumber/cancel", ah(async (req, res) => {
  const o = await loadOrder(req);
  if (o.status !== "pending_payment") throw forbidden("Only unpaid orders can be cancelled here. Contact support.");
  await cancelPendingOrder(o._id, { actor: "customer", note: "Cancelled by customer" });
  res.json(publicOrder(await Order.findById(o._id)));
}));

export default router;
