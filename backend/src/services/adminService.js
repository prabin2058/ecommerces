import mongoose from "mongoose";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import Coupon from "../models/Coupon.js";
import Category from "../models/Category.js";
import Product from "../models/Product.js";
import Variant from "../models/Variant.js";
import User from "../models/User.js";
import Event from "../models/Event.js";
import Notification from "../models/Notification.js";
import AuditLog from "../models/AuditLog.js";
import { allowedTransitions } from "./orderService.js";
import { audit, diff } from "./auditService.js";
import { escapeRegex, uniqueSlug } from "../lib/util.js";
import { invalidateCatalog } from "../lib/cache.js";
import { badRequest, conflict, notFound, validation, forbidden } from "../lib/errors.js";

const PAID = ["paid", "confirmed", "processing", "shipped", "delivered"];

export async function dashboard() {
  const now = Date.now();
  const d30 = new Date(now - 30 * 86400_000), d14 = new Date(now - 14 * 86400_000);
  const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
  const sum = async (from) => {
    const r = await Order.aggregate([{ $match: { status: { $in: PAID }, createdAt: { $gte: from } } }, { $group: { _id: null, revenue: { $sum: "$total" }, orders: { $sum: 1 } } }]);
    return r[0] || { revenue: 0, orders: 0 };
  };
  const [today, last30, byDay, statusCounts, top, recent, alerts, lowStock, funnelRaw, payFails, payAll] = await Promise.all([
    sum(startToday), sum(d30),
    Order.aggregate([
      { $match: { status: { $in: PAID }, createdAt: { $gte: d14 } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "+05:45" } }, revenue: { $sum: "$total" }, orders: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Order.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
    Order.aggregate([
      { $match: { status: { $in: PAID }, createdAt: { $gte: d30 } } }, { $unwind: "$items" },
      { $group: { _id: "$items.product", name: { $first: "$items.productName" }, image: { $first: "$items.image" }, units: { $sum: "$items.quantity" }, revenue: { $sum: "$items.lineTotal" } } },
      { $sort: { revenue: -1 } }, { $limit: 5 },
    ]),
    Order.find({}).sort({ createdAt: -1 }).limit(8).select("orderNumber email total status paymentStatus paymentMethod createdAt"),
    Notification.find({ channel: "admin", read: false }).sort({ createdAt: -1 }).limit(8),
    Variant.countDocuments({ isActive: true, $expr: { $lte: [{ $subtract: ["$onHand", "$reserved"] }, "$lowStockThreshold"] } }),
    Event.aggregate([{ $match: { createdAt: { $gte: d30 } } }, { $group: { _id: { type: "$type", visitor: "$visitor" } } }, { $group: { _id: "$_id.type", visitors: { $sum: 1 } } }]),
    Payment.countDocuments({ status: "failed", createdAt: { $gte: new Date(now - 86400_000) } }),
    Payment.countDocuments({ gateway: { $ne: "cod" }, createdAt: { $gte: new Date(now - 86400_000) } }),
  ]);
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now - i * 86400_000 + 5.75 * 3600_000).toISOString().slice(0, 10);
    const hit = byDay.find((x) => x._id === d);
    days.push({ date: d, revenue: hit?.revenue || 0, orders: hit?.orders || 0 });
  }
  const funnel = Object.fromEntries(funnelRaw.map((f) => [f._id, f.visitors]));
  // Base = widest step (visitors can add to cart from a listing without a product view).
  const views = Math.max(funnel.product_view || 0, funnel.add_to_cart || 0, funnel.checkout_start || 0);
  const stuck = await Order.countDocuments({ status: "pending_payment", createdAt: { $lt: new Date(now - 30 * 60_000) } });

  // Headline totals + change vs the previous 30 days, and revenue/order series for the trend chart.
  const d60 = new Date(now - 60 * 86400_000), d365 = new Date(now - 365 * 86400_000);
  const sumBetween = async (from, to) => {
    const r = await Order.aggregate([{ $match: { status: { $in: PAID }, createdAt: { $gte: from, $lt: to } } }, { $group: { _id: null, revenue: { $sum: "$total" }, orders: { $sum: 1 } } }]);
    return r[0] || { revenue: 0, orders: 0 };
  };
  const customerQ = { roles: { $nin: ["ADMIN", "CATALOG_MANAGER"] } };
  const [allTime, prev30, customers, customersNew, customersPrev, products, productsNew, productsPrev, inventory, yearByDay] = await Promise.all([
    sumBetween(new Date(0), new Date(now + 1)), sumBetween(d60, d30),
    User.countDocuments(customerQ), User.countDocuments({ ...customerQ, createdAt: { $gte: d30 } }), User.countDocuments({ ...customerQ, createdAt: { $gte: d60, $lt: d30 } }),
    Product.countDocuments({ status: { $ne: "archived" } }), Product.countDocuments({ status: { $ne: "archived" }, createdAt: { $gte: d30 } }), Product.countDocuments({ status: { $ne: "archived" }, createdAt: { $gte: d60, $lt: d30 } }),
    Variant.aggregate([{ $match: { isActive: true } }, { $group: { _id: null, value: { $sum: { $multiply: [{ $max: ["$onHand", 0] }, "$price"] } }, units: { $sum: "$onHand" } } }]),
    Order.aggregate([
      { $match: { status: { $in: PAID }, createdAt: { $gte: d365 } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "+05:45" } }, revenue: { $sum: "$total" }, orders: { $sum: 1 } } },
    ]),
  ]);
  // null = no previous-period baseline, so the UI shows no % rather than a misleading +100%.
  const change = (cur, prev) => (prev ? (cur - prev) / prev : null);
  const bucket = (keyOf, keys) => keys.map((k) => {
    const hits = yearByDay.filter((x) => keyOf(x._id) === k.key);
    return { label: k.label, revenue: hits.reduce((s, x) => s + x.revenue, 0), orders: hits.reduce((s, x) => s + x.orders, 0) };
  });
  const npt = (t) => new Date(t + 5.75 * 3600_000);
  const months = [];
  for (let i = 11; i >= 0; i--) { const d = npt(now); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - i); months.push({ key: d.toISOString().slice(0, 7), label: d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }) }); }
  const weekStart = (iso) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
  const weeks = [];
  for (let i = 11; i >= 0; i--) { const k = weekStart(npt(now - i * 7 * 86400_000).toISOString().slice(0, 10)); weeks.push({ key: k, label: new Date(`${k}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) }); }
  const totals = {
    orders: allTime.orders, ordersChange: change(last30.orders, prev30.orders),
    revenue: allTime.revenue, revenueChange: change(last30.revenue, prev30.revenue),
    customers, customersChange: change(customersNew, customersPrev),
    products, productsChange: change(productsNew, productsPrev),
    inventoryValue: inventory[0]?.value || 0, inventoryUnits: inventory[0]?.units || 0,
  };
  const series = {
    daily: days.map((d) => ({ label: new Date(`${d.date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }), revenue: d.revenue, orders: d.orders })),
    weekly: bucket(weekStart, weeks),
    monthly: bucket((iso) => iso.slice(0, 7), months),
  };
  return {
    totals, series,
    today, last30, aov: last30.orders ? Math.round(last30.revenue / last30.orders) : 0, byDay: days,
    statusCounts: Object.fromEntries(statusCounts.map((s) => [s._id, s.n])),
    topProducts: top, recentOrders: recent, alerts, lowStock, stuckPending: stuck,
    paymentFailureRate: payAll ? payFails / payAll : 0,
    funnel: {
      views: funnel.product_view || 0, visitors: views, addToCart: funnel.add_to_cart || 0, checkoutStart: funnel.checkout_start || 0, ordersPlaced: funnel.order_placed || 0, ordersPaid: funnel.order_paid || 0,
      addToCartRate: views ? (funnel.add_to_cart || 0) / views : 0, checkoutRate: views ? (funnel.checkout_start || 0) / views : 0, conversionRate: views ? (funnel.order_paid || 0) / views : 0,
    },
  };
}

export async function listOrders({ status, q, payment, page = 1, limit = 20, from, to }) {
  const f = {};
  if (status) f.status = status;
  if (payment) f.paymentStatus = payment;
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    f.$or = [{ orderNumber: rx }, { email: rx }, { phone: rx }, { "shippingAddress.fullName": rx }];
  }
  if (from || to) f.createdAt = { ...(from ? { $gte: new Date(from) } : {}), ...(to ? { $lte: new Date(to) } : {}) };
  limit = Math.min(Number(limit) || 20, 100);
  const [items, total] = await Promise.all([
    Order.find(f).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).select("-accessToken -idempotencyKey"),
    Order.countDocuments(f),
  ]);
  return { items, total, page: Number(page), pages: Math.ceil(total / limit) };
}

export async function getOrder(id) {
  const o = await Order.findById(id).select("-accessToken -idempotencyKey").populate("user", "name email");
  if (!o) throw notFound("Order not found");
  const payments = await Payment.find({ order: o._id }).sort({ createdAt: 1 }).select("-raw");
  return { ...o.toObject(), id: String(o._id), payments, allowedTransitions: allowedTransitions(o.status) };
}

// ---- Coupons ----
function couponInput(d) {
  const e = {};
  const out = {};
  if (d.code !== undefined) {
    out.code = String(d.code).toUpperCase().trim();
    if (!/^[A-Z0-9_-]{3,30}$/.test(out.code)) e.code = "3–30 letters, numbers, - or _";
  }
  if (d.type !== undefined) {
    if (!["percent", "fixed", "free_shipping"].includes(d.type)) e.type = "Invalid type";
    out.type = d.type;
  }
  for (const k of ["value", "minSpend", "maxDiscount", "usageLimit"]) {
    if (d[k] === undefined) continue;
    if (d[k] === null || d[k] === "") { out[k] = k === "usageLimit" ? null : undefined; continue; }
    const n = Number(d[k]);
    if (!Number.isInteger(n) || n < 0) e[k] = "Must be a whole number ≥ 0";
    out[k] = n;
  }
  if ((out.type || d.type) === "percent" && out.value > 100) e.value = "Percent must be 0–100";
  for (const k of ["startsAt", "expiresAt"]) if (d[k] !== undefined) out[k] = d[k] ? new Date(d[k]) : null;
  if (d.description !== undefined) out.description = String(d.description).slice(0, 200);
  if (d.isActive !== undefined) out.isActive = !!d.isActive;
  if (Object.keys(e).length) throw validation(e);
  return out;
}
export const listCoupons = () => Coupon.find({}).sort({ createdAt: -1 });
export async function createCoupon(d, user) {
  const c = await Coupon.create(couponInput({ type: "percent", ...d }));
  await audit(user, "coupon", c._id, "create", [{ field: "code", old: null, new: c.code }]);
  return c;
}
export async function updateCoupon(id, d, user) {
  const c = await Coupon.findById(id);
  if (!c) throw notFound("Coupon not found");
  const before = c.toObject();
  c.set(couponInput(d));
  await c.save();
  await audit(user, "coupon", c._id, "update", diff(before, c.toObject(), Object.keys(d)));
  return c;
}

// ---- Categories ----
export async function listAdminCategories() {
  const cats = await Category.find({}).sort({ position: 1, name: 1 }).lean();
  const counts = await Product.aggregate([{ $unwind: "$categories" }, { $group: { _id: "$categories", n: { $sum: 1 } } }]);
  const m = new Map(counts.map((c) => [String(c._id), c.n]));
  return cats.map((c) => ({ ...c, id: String(c._id), productCount: m.get(String(c._id)) || 0 }));
}
export async function saveCategory(id, d, user) {
  const name = String(d.name || "").trim();
  if (name.length < 2) throw validation({ name: "Name is required" });
  if (d.parent && !mongoose.isValidObjectId(d.parent)) throw validation({ parent: "Invalid parent" });
  if (id && d.parent && String(d.parent) === String(id)) throw validation({ parent: "A category cannot be its own parent" });
  const data = { name, description: d.description, isActive: d.isActive !== false, parent: d.parent || null, position: Number(d.position) || 0 };
  let c;
  if (id) {
    c = await Category.findById(id);
    if (!c) throw notFound("Category not found");
    const before = c.toObject();
    c.set({ ...data, slug: d.slug ? await uniqueSlug(Category, d.slug, c._id) : c.slug });
    await c.save();
    await audit(user, "category", c._id, "update", diff(before, c.toObject(), Object.keys(data)));
  } else {
    c = await Category.create({ ...data, slug: await uniqueSlug(Category, d.slug || name) });
    await audit(user, "category", c._id, "create", [{ field: "name", old: null, new: name }]);
  }
  invalidateCatalog();
  return c;
}
export async function deleteCategory(id, user) {
  if (await Product.exists({ categories: id })) throw conflict("CATEGORY_IN_USE", "Products use this category. Deactivate it instead.");
  if (await Category.exists({ parent: id })) throw conflict("CATEGORY_HAS_CHILDREN", "Move or delete its sub-categories first.");
  await Category.deleteOne({ _id: id });
  await audit(user, "category", id, "delete");
  invalidateCatalog();
}

// ---- Users / roles (admin only) ----
export async function listUsers({ q }) {
  const f = q ? { $or: [{ name: new RegExp(escapeRegex(q), "i") }, { email: new RegExp(escapeRegex(q), "i") }] } : {};
  const users = await User.find(f).sort({ createdAt: -1 }).limit(100);
  return users.map((u) => ({ id: String(u._id), name: u.name, email: u.email, roles: u.roles, twoFactorEnabled: !!u.twoFactor?.enabled, createdAt: u.createdAt || u.createdAT }));
}
export async function setRoles(id, roles, user) {
  const allowed = ["USER", "CATALOG_MANAGER", "ADMIN"];
  if (!Array.isArray(roles) || roles.some((r) => !allowed.includes(r))) throw badRequest("INVALID_ROLES", "Invalid roles");
  if (String(id) === String(user.id) && !roles.includes("ADMIN")) throw forbidden("You cannot remove your own admin role");
  const u = await User.findById(id);
  if (!u) throw notFound("User not found");
  const before = u.roles;
  u.roles = [...new Set(["USER", ...roles])];
  await u.save();
  await audit(user, "user", u._id, "roles", [{ field: "roles", old: before, new: u.roles }]);
  return { id: String(u._id), roles: u.roles };
}

export async function activity({ type = "audit", page = 1, limit = 50, channel }) {
  limit = Math.min(Number(limit) || 50, 200);
  if (type === "notifications") {
    const f = channel ? { channel } : {};
    const [items, total] = await Promise.all([Notification.find(f).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit), Notification.countDocuments(f)]);
    return { items, total, page: Number(page), pages: Math.ceil(total / limit) };
  }
  const [items, total] = await Promise.all([AuditLog.find({}).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit), AuditLog.countDocuments({})]);
  return { items, total, page: Number(page), pages: Math.ceil(total / limit) };
}
export const markNotificationsRead = (ids) => Notification.updateMany(ids?.length ? { _id: { $in: ids } } : { channel: "admin", read: false }, { read: true });
