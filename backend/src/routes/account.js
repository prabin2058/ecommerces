import express from "express";
import User from "../models/User.js";
import Order from "../models/Order.js";
import { ah, notFound, validation } from "../lib/errors.js";
import { requireAuth } from "../middlewares/auth.js";
import { publicOrder } from "../services/orderService.js";
import { validateAddress } from "../services/checkoutService.js";

const router = express.Router();
router.use(requireAuth);

router.get("/orders", ah(async (req, res) => {
  const orders = await Order.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(100);
  res.json(orders.map((o) => publicOrder(o, { includeToken: true })));
}));

router.get("/addresses", ah(async (req, res) => res.json((await User.findById(req.user.id))?.addresses || [])));

router.post("/addresses", ah(async (req, res) => {
  const e = validateAddress(req.body);
  if (Object.keys(e).length) throw validation(e);
  const u = await User.findById(req.user.id);
  if (u.addresses.length >= 10) throw validation({ address: "Up to 10 addresses" });
  const isDefault = !!req.body.isDefault || !u.addresses.length;
  if (isDefault) u.addresses.forEach((a) => (a.isDefault = false));
  const { fullName, phone, line1, line2, city, province, postalCode, label } = req.body;
  u.addresses.push({ fullName, phone, line1, line2, city, province, postalCode, label, isDefault });
  await u.save();
  res.status(201).json(u.addresses);
}));

router.patch("/addresses/:id", ah(async (req, res) => {
  const u = await User.findById(req.user.id);
  const a = u.addresses.id(req.params.id);
  if (!a) throw notFound("Address not found");
  const next = { ...a.toObject(), ...req.body };
  const e = validateAddress(next);
  if (Object.keys(e).length) throw validation(e);
  if (req.body.isDefault) u.addresses.forEach((x) => (x.isDefault = false));
  a.set(Object.fromEntries(Object.entries(req.body).filter(([k]) => ["fullName", "phone", "line1", "line2", "city", "province", "postalCode", "label", "isDefault"].includes(k))));
  await u.save();
  res.json(u.addresses);
}));

router.delete("/addresses/:id", ah(async (req, res) => {
  const u = await User.findById(req.user.id);
  u.addresses.pull(req.params.id);
  if (u.addresses.length && !u.addresses.some((a) => a.isDefault)) u.addresses[0].isDefault = true;
  await u.save();
  res.json(u.addresses);
}));

export default router;
