import express from "express";
import { ah } from "../lib/errors.js";
import { requireStaff, requireRole } from "../middlewares/auth.js";
import * as products from "../services/productAdminService.js";
import * as admin from "../services/adminService.js";
import { adjustStock } from "../services/inventoryService.js";
import { importCsv, exportCsv, CSV_HEADERS } from "../services/importService.js";
import { presign, receiveUpload } from "../services/uploadService.js";
import { adminUpdateStatus } from "../services/orderService.js";
import { dailyReconciliation, expireReservations } from "../jobs/scheduler.js";
import Variant from "../models/Variant.js";
import config from "../config.js";

const router = express.Router();
router.use(requireStaff);
router.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
const adminOnly = requireRole("ADMIN");

router.get("/me", (req, res) => res.json({ user: req.user, require2fa: config.requireAdmin2fa }));
router.get("/dashboard", ah(async (req, res) => res.json(await admin.dashboard())));

// ---- Products ----
router.get("/products", ah(async (req, res) => res.json(await products.listProducts(req.query))));
router.post("/products", ah(async (req, res) => res.status(201).json(await products.createProduct(req.body || {}, req.user))));
router.get("/products/export", ah(async (req, res) => {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="products-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(await exportCsv());
}));
router.get("/products/import/template", (req, res) => {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="product-import-template.csv"');
  res.send(`${CSV_HEADERS.join(",")}\r\ncotton-tee,Cotton T-shirt,"<p>Soft cotton tee</p>",clothing,Prabin Basics,draft,standard,TEE-S-BLK,1200,1500,600,20,Size,S,Color,Black,,,,250\r\ncotton-tee,Cotton T-shirt,,,,,,TEE-M-BLK,1200,1500,600,15,Size,M,Color,Black,,,,250\r\n`);
});
router.post("/products/import", express.text({ type: ["text/csv", "text/plain"], limit: "5mb" }), ah(async (req, res) => {
  const text = typeof req.body === "string" ? req.body : req.body?.csv || "";
  res.json(await importCsv(text, { dryRun: req.query.dryRun !== "false", user: req.user }));
}));
router.post("/products/bulk", ah(async (req, res) => res.json(await products.bulkAction(req.body || {}, req.user))));
router.get("/products/:id", ah(async (req, res) => res.json(await products.getProduct(req.params.id))));
router.get("/products/:id/publish-check", ah(async (req, res) => {
  const p = await (await import("../models/Product.js")).default.findById(req.params.id);
  res.json({ issues: p ? await products.publishIssues(p) : ["Product not found"] });
}));
router.patch("/products/:id", ah(async (req, res) => res.json(await products.updateProduct(req.params.id, req.body || {}, req.user))));
router.post("/products/:id/publish", ah(async (req, res) => res.json(await products.publishProduct(req.params.id, req.user, req.body || {}))));
router.post("/products/:id/unpublish", ah(async (req, res) => res.json(await products.setStatus(req.params.id, "draft", req.user))));
router.post("/products/:id/archive", ah(async (req, res) => res.json(await products.setStatus(req.params.id, "archived", req.user))));
router.post("/products/:id/duplicate", ah(async (req, res) => res.status(201).json(await products.duplicateProduct(req.params.id, req.user))));
router.delete("/products/:id", adminOnly, ah(async (req, res) => {
  await products.deleteProduct(req.params.id, req.user);
  res.status(204).end();
}));
router.post("/products/:id/variants", ah(async (req, res) => res.json(await products.setOptions(req.params.id, req.body?.options, req.body || {}, req.user))));
router.patch("/variants/:id", ah(async (req, res) => res.json(await products.updateVariant(req.params.id, req.body || {}, req.user))));
router.post("/products/:id/images", ah(async (req, res) => res.json(await products.attachImage(req.params.id, req.body || {}, req.user))));
router.put("/products/:id/images", ah(async (req, res) => res.json(await products.updateImages(req.params.id, req.body?.images || [], req.user))));

// ---- Uploads (pre-signed) ----
router.post("/uploads/presign", ah(async (req, res) => res.json(presign(req.body || {}, req.user))));
router.put("/uploads/:key", express.raw({ type: () => true, limit: config.upload.maxBytes + 1024 }), ah(async (req, res) => {
  res.status(201).json(await receiveUpload(req.params.key, req.query, req.body, req.user));
}));

// ---- Inventory ----
router.post("/inventory/:variantId/adjust", ah(async (req, res) => {
  const { change, reason = "manual_adjust", note } = req.body || {};
  const allowed = ["restock", "manual_adjust", "damaged", "return", "initial"];
  const v = await adjustStock(req.params.variantId, Number(change), allowed.includes(reason) ? reason : "manual_adjust", { note, user: req.user });
  res.json({ id: String(v._id), sku: v.sku, onHand: v.onHand, reserved: v.reserved, available: v.onHand - v.reserved });
}));
router.get("/inventory/logs", ah(async (req, res) => res.json(await products.inventoryLogs(req.query))));
router.get("/inventory/low-stock", ah(async (req, res) => {
  const vs = await Variant.find({ isActive: true, $expr: { $lte: [{ $subtract: ["$onHand", "$reserved"] }, "$lowStockThreshold"] } }).populate("product", "name slug status").limit(200);
  res.json(vs.map((v) => ({ id: String(v._id), sku: v.sku, product: v.product, label: products.variantLabel(v), onHand: v.onHand, reserved: v.reserved, available: v.onHand - v.reserved, threshold: v.lowStockThreshold })));
}));

// ---- Orders ----
router.get("/orders", ah(async (req, res) => res.json(await admin.listOrders(req.query))));
router.get("/orders/:id", ah(async (req, res) => res.json(await admin.getOrder(req.params.id))));
router.post("/orders/:id/status", adminOnly, ah(async (req, res) => {
  await adminUpdateStatus(req.params.id, req.body || {}, req.user);
  res.json(await admin.getOrder(req.params.id));
}));

// ---- Coupons ----
router.get("/coupons", ah(async (req, res) => res.json(await admin.listCoupons())));
router.post("/coupons", adminOnly, ah(async (req, res) => res.status(201).json(await admin.createCoupon(req.body || {}, req.user))));
router.patch("/coupons/:id", adminOnly, ah(async (req, res) => res.json(await admin.updateCoupon(req.params.id, req.body || {}, req.user))));

// ---- Categories ----
router.get("/categories", ah(async (req, res) => res.json(await admin.listAdminCategories())));
router.post("/categories", ah(async (req, res) => res.status(201).json(await admin.saveCategory(null, req.body || {}, req.user))));
router.patch("/categories/:id", ah(async (req, res) => res.json(await admin.saveCategory(req.params.id, req.body || {}, req.user))));
router.delete("/categories/:id", adminOnly, ah(async (req, res) => {
  await admin.deleteCategory(req.params.id, req.user);
  res.status(204).end();
}));

// ---- Users & activity ----
router.get("/users", adminOnly, ah(async (req, res) => res.json(await admin.listUsers(req.query))));
router.post("/users/:id/roles", adminOnly, ah(async (req, res) => res.json(await admin.setRoles(req.params.id, req.body?.roles, req.user))));
router.get("/activity", ah(async (req, res) => res.json(await admin.activity(req.query))));
router.post("/notifications/read", ah(async (req, res) => {
  await admin.markNotificationsRead(req.body?.ids);
  res.json({ ok: true });
}));

// ---- Ops ----
router.post("/jobs/reconcile", adminOnly, ah(async (req, res) => res.json(await dailyReconciliation({ hours: Number(req.body?.hours) || 24 }))));
router.post("/jobs/expire-reservations", adminOnly, ah(async (req, res) => res.json(await expireReservations())));

export default router;
