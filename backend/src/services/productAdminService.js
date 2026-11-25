import mongoose from "mongoose";
import Product from "../models/Product.js";
import Variant, { variantLabel } from "../models/Variant.js";
import Category from "../models/Category.js";
import Order from "../models/Order.js";
import InventoryLog from "../models/InventoryLog.js";
import { audit, diff } from "./auditService.js";
import { adjustStock, syncProductPrices } from "./inventoryService.js";
import { sanitizeDescription, plainText } from "../lib/sanitize.js";
import { uniqueSlug, slugify, escapeRegex } from "../lib/util.js";
import { invalidateCatalog } from "../lib/cache.js";
import { badRequest, conflict, notFound, validation, forbidden } from "../lib/errors.js";
import { hasRole } from "../middlewares/auth.js";

const EDITABLE = ["name", "slug", "description", "categories", "brand", "basePrice", "compareAtPrice", "costPrice", "taxClass",
  "weightGrams", "dimensionsCm", "allowBackorder", "seoTitle", "seoDescription", "featured", "publishAt"];

const isInt = (n) => Number.isInteger(n);

function validateFields(data, { partial = false } = {}) {
  const e = {};
  if (!partial || data.name !== undefined) {
    const n = String(data.name || "").trim();
    if (n.length < 3 || n.length > 150) e.name = "Name must be 3–150 characters";
  }
  if (!partial || data.basePrice !== undefined) {
    if (!isInt(data.basePrice) || data.basePrice <= 0) e.basePrice = "Price must be greater than 0";
  }
  if (data.compareAtPrice !== undefined && data.compareAtPrice !== null && data.compareAtPrice !== "") {
    if (!isInt(data.compareAtPrice) || data.compareAtPrice < 0) e.compareAtPrice = "Invalid compare-at price";
  }
  if (data.costPrice !== undefined && data.costPrice !== null && data.costPrice !== "" && (!isInt(data.costPrice) || data.costPrice < 0))
    e.costPrice = "Invalid cost price";
  if (data.taxClass !== undefined && !["standard", "reduced", "exempt"].includes(data.taxClass)) e.taxClass = "Invalid tax class";
  if (data.slug !== undefined && data.slug !== "" && slugify(data.slug) !== data.slug) e.slug = "Use lowercase letters, numbers and dashes";
  return e;
}

function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

function clean(data) {
  const d = pick(data, EDITABLE);
  if (d.description !== undefined) d.description = sanitizeDescription(d.description);
  if (d.name !== undefined) d.name = String(d.name).trim();
  if (d.brand !== undefined) d.brand = String(d.brand || "").trim() || undefined;
  for (const k of ["compareAtPrice", "costPrice"]) if (d[k] === "" || d[k] === null) d[k] = undefined;
  if (d.publishAt === "" ) d.publishAt = null;
  if (d.categories) d.categories = [...new Set(d.categories.map(String))].filter((id) => mongoose.isValidObjectId(id));
  return d;
}

export function adminProductJSON(p, variants = []) {
  const obj = p.toObject ? p.toObject() : p;
  return {
    ...obj,
    id: String(obj._id),
    images: [...(obj.images || [])].sort((a, b) => a.position - b.position),
    variants: variants.map((v) => ({ ...(v.toJSON ? v.toJSON() : v), id: String(v._id), label: variantLabel(v), available: v.onHand - v.reserved })),
    stock: variants.reduce((s, v) => s + (v.isActive ? v.onHand - v.reserved : 0), 0),
  };
}

export async function getProduct(id) {
  const p = await Product.findById(id).populate("categories", "name slug isActive");
  if (!p) throw notFound("Product not found");
  const variants = await Variant.find({ product: p._id }).sort({ position: 1, createdAt: 1 });
  return adminProductJSON(p, variants);
}

export async function publishIssues(p) {
  const issues = [];
  const prod = p.toObject ? p.toObject() : p;
  if (!prod.name || prod.name.trim().length < 3) issues.push("Name is required (3–150 characters)");
  if (!plainText(prod.description)) issues.push("Description is required");
  if (!(prod.basePrice > 0)) issues.push("Price must be greater than 0");
  if (!prod.images?.length) issues.push("At least one image is required");
  const catIds = (prod.categories || []).map((c) => c._id || c);
  const activeCats = catIds.length ? await Category.countDocuments({ _id: { $in: catIds }, isActive: true }) : 0;
  if (!activeCats) issues.push("At least one active category is required");
  const variants = await Variant.find({ product: prod._id, isActive: true });
  if (!variants.some((v) => v.sku)) issues.push("At least one active variant with a SKU is required");
  for (const v of variants) {
    if (v.compareAtPrice && v.compareAtPrice <= v.price) issues.push(`Variant ${v.sku}: compare-at price must be greater than price`);
  }
  if (prod.compareAtPrice && prod.compareAtPrice <= prod.basePrice) issues.push("Compare-at price must be greater than price");
  return issues;
}

export async function listProducts({ status, category, q, stock, sort = "-updatedAt", page = 1, limit = 20 }) {
  const filter = {};
  if (status === "scheduled") Object.assign(filter, { status: "draft", publishAt: { $ne: null } });
  else if (status) filter.status = status;
  if (category && mongoose.isValidObjectId(category)) filter.categories = category;
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    const skuMatches = await Variant.find({ sku: rx }, { product: 1 }).limit(200);
    filter.$or = [{ name: rx }, { brand: rx }, { slug: rx }, { _id: { $in: skuMatches.map((v) => v.product) } }];
  }
  if (stock === "low" || stock === "out") {
    const cond = stock === "out"
      ? { $lte: [{ $subtract: ["$onHand", "$reserved"] }, 0] }
      : { $and: [{ $gt: [{ $subtract: ["$onHand", "$reserved"] }, 0] }, { $lte: [{ $subtract: ["$onHand", "$reserved"] }, "$lowStockThreshold"] }] };
    const vs = await Variant.find({ isActive: true, $expr: cond }, { product: 1 });
    filter._id = { $in: vs.map((v) => v.product) };
  }
  const sortMap = { "-updatedAt": { updatedAt: -1 }, name: { name: 1 }, "-name": { name: -1 }, price: { priceMin: 1 }, "-price": { priceMin: -1 }, "-createdAt": { createdAt: -1 } };
  limit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  page = Math.max(Number(page) || 1, 1);
  const [items, total] = await Promise.all([
    Product.find(filter).sort(sortMap[sort] || sortMap["-updatedAt"]).skip((page - 1) * limit).limit(limit).populate("categories", "name"),
    Product.countDocuments(filter),
  ]);
  const variants = await Variant.find({ product: { $in: items.map((p) => p._id) } });
  const byProduct = new Map();
  for (const v of variants) {
    const k = String(v.product);
    if (!byProduct.has(k)) byProduct.set(k, []);
    byProduct.get(k).push(v);
  }
  return {
    items: items.map((p) => {
      const vs = byProduct.get(String(p._id)) || [];
      const active = vs.filter((v) => v.isActive);
      return {
        id: String(p._id), name: p.name, slug: p.slug, status: p.status, publishAt: p.publishAt, brand: p.brand,
        categories: p.categories.map((c) => c.name), image: [...p.images].sort((a, b) => a.position - b.position)[0]?.url,
        priceMin: p.priceMin, priceMax: p.priceMax, variantCount: active.length,
        stock: active.reduce((s, v) => s + v.onHand - v.reserved, 0),
        lowStock: active.some((v) => v.onHand - v.reserved <= v.lowStockThreshold),
        updatedAt: p.updatedAt,
      };
    }),
    total, page, pages: Math.ceil(total / limit),
  };
}

async function assertSkuFree(sku, excludeId) {
  const q = { sku: String(sku).toUpperCase().trim() };
  if (excludeId) q._id = { $ne: excludeId };
  if (await Variant.exists(q)) throw conflict("DUPLICATE_SKU", `SKU ${q.sku} is already used`, { field: "sku" });
}

export async function createProduct(data, user) {
  const errors = validateFields(data);
  if (!data.sku || !String(data.sku).trim()) errors.sku = "SKU is required";
  const stock = data.stock === undefined || data.stock === "" ? 0 : Number(data.stock);
  if (!Number.isInteger(stock) || stock < 0) errors.stock = "Stock must be 0 or more";
  if (Object.keys(errors).length) throw validation(errors);
  await assertSkuFree(data.sku);
  const d = clean(data);
  d.slug = await uniqueSlug(Product, d.slug || d.name);
  const p = await Product.create({ ...d, status: "draft", createdBy: user.id, options: [] });
  const v = await Variant.create({
    product: p._id, sku: data.sku, price: p.basePrice, compareAtPrice: p.compareAtPrice, costPrice: p.costPrice,
    isDefault: true, options: {}, lowStockThreshold: data.lowStockThreshold ?? 5,
  });
  if (stock > 0) await adjustStock(v._id, stock, "initial", { user });
  await syncProductPrices(p._id);
  await audit(user, "product", p._id, "create", [{ field: "name", old: null, new: p.name }]);
  invalidateCatalog();
  return getProduct(p._id);
}

export async function updateProduct(id, data, user) {
  const p = await Product.findById(id);
  if (!p) throw notFound("Product not found");
  const errors = validateFields(data, { partial: true });
  if (Object.keys(errors).length) throw validation(errors);
  const d = clean(data);
  if (d.slug !== undefined) d.slug = await uniqueSlug(Product, d.slug || d.name || p.name, p._id);
  const before = p.toObject();
  const priceChanged = d.basePrice !== undefined && d.basePrice !== p.basePrice;
  p.set(d);
  if (p.status === "active") {
    // Keep active products publishable.
    const issues = await publishIssues(p);
    if (issues.length) throw validation({ publish: issues }, "This change would make the live product invalid");
  }
  await p.save();
  if (priceChanged) {
    // Variants that were following the base price follow it again.
    await Variant.updateMany({ product: p._id, price: before.basePrice }, { price: p.basePrice });
    await syncProductPrices(p._id);
  }
  await audit(user, "product", p._id, "update", diff(before, p.toObject(), Object.keys(d)));
  invalidateCatalog();
  return getProduct(p._id);
}

export async function publishProduct(id, user, { publishAt } = {}) {
  const p = await Product.findById(id);
  if (!p) throw notFound("Product not found");
  const issues = await publishIssues(p);
  if (issues.length) throw validation({ publish: issues }, "Product cannot be published yet");
  const before = { status: p.status, publishAt: p.publishAt };
  if (publishAt && new Date(publishAt) > new Date()) {
    p.status = "draft";
    p.publishAt = new Date(publishAt);
  } else {
    p.status = "active";
    p.publishAt = null;
    p.publishedAt = new Date();
  }
  await p.save();
  await audit(user, "product", p._id, p.status === "active" ? "publish" : "schedule", diff(before, p.toObject(), ["status", "publishAt"]));
  invalidateCatalog();
  return getProduct(p._id);
}

export async function setStatus(id, status, user) {
  const p = await Product.findById(id);
  if (!p) throw notFound("Product not found");
  if (status === "active") return publishProduct(id, user);
  const before = { status: p.status };
  p.status = status;
  p.publishAt = null;
  await p.save();
  await audit(user, "product", p._id, status === "archived" ? "archive" : "unpublish", diff(before, { status }, ["status"]));
  invalidateCatalog();
  return getProduct(p._id);
}

export async function deleteProduct(id, user) {
  if (!hasRole(user)) throw forbidden("Only admins can delete products");
  const p = await Product.findById(id);
  if (!p) throw notFound("Product not found");
  if (await Order.exists({ "items.product": p._id }))
    throw conflict("PRODUCT_IN_ORDERS", "This product appears in past orders. Archive it instead.");
  await Variant.deleteMany({ product: p._id });
  await p.deleteOne();
  await audit(user, "product", id, "delete", [{ field: "name", old: p.name, new: null }]);
  invalidateCatalog();
}

const combos = (options) =>
  options.reduce((acc, opt) => acc.flatMap((c) => opt.values.map((val) => ({ ...c, [opt.name]: val }))), [{}]);

const sameOptions = (a, b) => {
  const ao = a instanceof Map ? Object.fromEntries(a) : a || {};
  const ka = Object.keys(ao), kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => ao[k] === b[k]);
};

const skuPart = (s) => String(s).toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 8) || "X";

// Define options (Size: S,M,L × Color: Red,Blue) and generate one variant per combination.
export async function setOptions(id, options, { skuPrefix } = {}, user) {
  const p = await Product.findById(id);
  if (!p) throw notFound("Product not found");
  const cleanOpts = (options || [])
    .map((o) => ({ name: String(o.name || "").trim(), values: [...new Set((o.values || []).map((v) => String(v).trim()).filter(Boolean))] }))
    .filter((o) => o.name && o.values.length);
  if (new Set(cleanOpts.map((o) => o.name.toLowerCase())).size !== cleanOpts.length) throw badRequest("DUPLICATE_OPTION", "Option names must be unique");
  if (cleanOpts.length > 3) throw badRequest("TOO_MANY_OPTIONS", "Up to 3 options are supported");
  const wanted = combos(cleanOpts);
  if (wanted.length > 100) throw badRequest("TOO_MANY_VARIANTS", "That would create more than 100 variants");

  const existing = await Variant.find({ product: p._id });
  const prefix = skuPart(skuPrefix || existing.find((v) => v.isDefault)?.sku || existing[0]?.sku || p.slug).slice(0, 12);
  const keep = new Set();
  let created = 0;
  for (const [i, combo] of wanted.entries()) {
    const match = existing.find((v) => sameOptions(v.options, combo));
    if (match) {
      keep.add(String(match._id));
      await Variant.updateOne({ _id: match._id }, { isActive: true, position: i, isDefault: cleanOpts.length === 0 });
      continue;
    }
    let sku = [prefix, ...Object.values(combo).map(skuPart)].join("-");
    for (let n = 2; await Variant.exists({ sku }); n++) sku = `${[prefix, ...Object.values(combo).map(skuPart)].join("-")}-${n}`;
    const v = await Variant.create({
      product: p._id, sku, options: combo, price: p.basePrice, compareAtPrice: p.compareAtPrice, costPrice: p.costPrice,
      position: i, isDefault: cleanOpts.length === 0,
    });
    keep.add(String(v._id));
    created++;
  }
  // Combinations that no longer exist are deactivated (kept for order history).
  const deactivated = existing.filter((v) => !keep.has(String(v._id)) && v.isActive);
  if (deactivated.length) await Variant.updateMany({ _id: { $in: deactivated.map((v) => v._id) } }, { isActive: false });
  const before = p.options;
  p.options = cleanOpts;
  await p.save();
  await syncProductPrices(p._id);
  await audit(user, "product", p._id, "variants", [{ field: "options", old: before, new: cleanOpts }, { field: "variants", old: null, new: `+${created} created, ${deactivated.length} deactivated` }]);
  invalidateCatalog();
  return getProduct(p._id);
}

export async function updateVariant(id, data, user) {
  const v = await Variant.findById(id);
  if (!v) throw notFound("Variant not found");
  const e = {};
  const d = pick(data, ["sku", "price", "compareAtPrice", "costPrice", "isActive", "lowStockThreshold", "weightGrams", "image"]);
  if (d.sku !== undefined) {
    if (!String(d.sku).trim()) e.sku = "SKU is required";
    else await assertSkuFree(d.sku, v._id);
  }
  if (d.price !== undefined && (!isInt(d.price) || d.price <= 0)) e.price = "Price must be greater than 0";
  for (const k of ["compareAtPrice", "costPrice"]) {
    if (d[k] === "" || d[k] === null) d[k] = undefined;
    else if (d[k] !== undefined && (!isInt(d[k]) || d[k] < 0)) e[k] = "Invalid amount";
  }
  const price = d.price ?? v.price;
  if (d.compareAtPrice && d.compareAtPrice <= price) e.compareAtPrice = "Must be greater than price";
  if (d.lowStockThreshold !== undefined && (!isInt(d.lowStockThreshold) || d.lowStockThreshold < 0)) e.lowStockThreshold = "Invalid threshold";
  if (Object.keys(e).length) throw validation(e);
  const before = v.toObject();
  const unset = Object.keys(d).filter((k) => d[k] === undefined);
  for (const k of unset) v[k] = undefined;
  v.set(Object.fromEntries(Object.entries(d).filter(([, val]) => val !== undefined)));
  await v.save();
  const p = await Product.findById(v.product);
  if (p?.status === "active") {
    const issues = await publishIssues(p);
    if (issues.length) {
      v.set(before);
      await v.save();
      throw validation({ publish: issues }, "This change would make the live product invalid");
    }
  }
  await syncProductPrices(v.product);
  await audit(user, "variant", v._id, "update", diff(before, v.toObject(), Object.keys(d)));
  invalidateCatalog();
  return v;
}

export async function attachImage(productId, { url, altText = "", variantId = null }, user) {
  const p = await Product.findById(productId);
  if (!p) throw notFound("Product not found");
  if (!url || !/^\/images\/uploads\/[\w.-]+$|^https:\/\//.test(url)) throw badRequest("INVALID_URL", "Upload the image first");
  if (p.images.length >= 20) throw badRequest("TOO_MANY_IMAGES", "Up to 20 images per product");
  p.images.push({ url, altText: String(altText).slice(0, 200), position: p.images.length, variant: variantId || null });
  await p.save();
  await audit(user, "product", p._id, "image_add", [{ field: "images", old: null, new: url }]);
  invalidateCatalog();
  return getProduct(p._id);
}

// Replace image order / alt text / removals in one call: images = [{id, altText, variant}] in display order.
export async function updateImages(productId, images, user) {
  const p = await Product.findById(productId);
  if (!p) throw notFound("Product not found");
  const byId = new Map(p.images.map((i) => [String(i._id), i]));
  const next = images
    .filter((i) => byId.has(String(i.id)))
    .map((i, position) => ({ ...byId.get(String(i.id)).toObject(), altText: i.altText ?? byId.get(String(i.id)).altText, variant: i.variant || null, position }));
  if (p.status === "active" && !next.length) throw validation({ images: "A live product needs at least one image" });
  const before = p.images.map((i) => i.url);
  p.images = next;
  await p.save();
  await audit(user, "product", p._id, "images", [{ field: "images", old: before, new: next.map((i) => i.url) }]);
  invalidateCatalog();
  return getProduct(p._id);
}

export async function duplicateProduct(id, user) {
  const src = await Product.findById(id);
  if (!src) throw notFound("Product not found");
  const o = src.toObject();
  delete o._id; delete o.createdAt; delete o.updatedAt; delete o.publishedAt;
  const copy = await Product.create({
    ...o, name: `${src.name} (Copy)`.slice(0, 150), slug: await uniqueSlug(Product, `${src.slug}-copy`), status: "draft", publishAt: null,
    images: o.images.map(({ _id, ...img }) => ({ ...img, variant: null })), createdBy: user.id,
  });
  const vs = await Variant.find({ product: src._id, isActive: true });
  for (const v of vs) {
    let sku = `${v.sku}-COPY`;
    for (let n = 2; await Variant.exists({ sku }); n++) sku = `${v.sku}-COPY${n}`;
    const vo = v.toObject();
    await Variant.create({ ...pick(vo, ["options", "price", "compareAtPrice", "costPrice", "weightGrams", "isDefault", "lowStockThreshold", "position"]), product: copy._id, sku, onHand: 0, reserved: 0 });
  }
  await syncProductPrices(copy._id);
  await audit(user, "product", copy._id, "duplicate", [{ field: "source", old: null, new: String(src._id) }]);
  invalidateCatalog();
  return getProduct(copy._id);
}

export async function bulkAction({ ids = [], action, value }, user) {
  if (!Array.isArray(ids) || !ids.length) throw badRequest("NO_SELECTION", "Select at least one product");
  if (["adjust_price", "delete"].includes(action) && !hasRole(user)) throw forbidden("Only admins can do this in bulk");
  const results = [];
  for (const id of ids) {
    try {
      if (action === "publish") await publishProduct(id, user);
      else if (action === "archive") await setStatus(id, "archived", user);
      else if (action === "draft") await setStatus(id, "draft", user);
      else if (action === "set_category") {
        if (!mongoose.isValidObjectId(value)) throw badRequest("INVALID_CATEGORY", "Choose a category");
        await updateProduct(id, { categories: [value] }, user);
      } else if (action === "add_category") {
        const p = await Product.findById(id);
        await updateProduct(id, { categories: [...p.categories.map(String), value] }, user);
      } else if (action === "adjust_price") {
        const pct = Number(value);
        if (!Number.isFinite(pct) || pct <= -90 || pct > 500) throw badRequest("INVALID_PERCENT", "Enter a % between -90 and 500");
        const vs = await Variant.find({ product: id });
        for (const v of vs) {
          const price = Math.max(100, Math.round((v.price * (1 + pct / 100)) / 100) * 100); // round to whole rupee
          const before = v.price;
          v.price = price;
          if (v.compareAtPrice && v.compareAtPrice <= price) v.compareAtPrice = undefined;
          await v.save();
          await audit(user, "variant", v._id, "bulk_price", [{ field: "price", old: before, new: price }]);
        }
        const p = await Product.findById(id);
        p.basePrice = Math.max(100, Math.round((p.basePrice * (1 + pct / 100)) / 100) * 100);
        if (p.compareAtPrice && p.compareAtPrice <= p.basePrice) p.compareAtPrice = undefined;
        await p.save();
        await syncProductPrices(id);
      } else if (action === "delete") await deleteProduct(id, user);
      else throw badRequest("UNKNOWN_ACTION", "Unknown bulk action");
      results.push({ id, ok: true });
    } catch (e) {
      results.push({ id, ok: false, error: e.message, details: e.details });
    }
  }
  invalidateCatalog();
  return { results, succeeded: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length };
}

export async function inventoryLogs({ variant, product, page = 1, limit = 50 }) {
  const f = {};
  if (variant) f.variant = variant;
  if (product) f.product = product;
  limit = Math.min(Number(limit) || 50, 200);
  const [items, total] = await Promise.all([
    InventoryLog.find(f).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate("user", "name"),
    InventoryLog.countDocuments(f),
  ]);
  return { items, total, page: Number(page), pages: Math.ceil(total / limit) };
}

export { variantLabel };
