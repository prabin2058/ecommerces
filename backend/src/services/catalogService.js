import mongoose from "mongoose";
import Product from "../models/Product.js";
import Variant, { variantLabel } from "../models/Variant.js";
import Category from "../models/Category.js";
import { cached } from "../lib/cache.js";
import { escapeRegex } from "../lib/util.js";
import { notFound } from "../lib/errors.js";

const sortImages = (imgs = []) => [...imgs].sort((a, b) => a.position - b.position);

function card(p, variants) {
  const active = variants.filter((v) => v.isActive);
  const available = active.reduce((s, v) => s + Math.max(0, v.onHand - v.reserved), 0);
  const cheapest = active.reduce((m, v) => (!m || v.price < m.price ? v : m), null);
  const images = sortImages(p.images);
  return {
    id: String(p._id), name: p.name, slug: p.slug, brand: p.brand,
    image: images[0]?.url || null, imageAlt: images[0]?.altText || p.name, hoverImage: images[1]?.url || null,
    priceMin: p.priceMin, priceMax: p.priceMax,
    compareAtPrice: cheapest?.compareAtPrice || p.compareAtPrice || null,
    inStock: p.allowBackorder || available > 0, lowStock: available > 0 && available <= 5,
    categories: (p.categories || []).map((c) => (c.name ? { name: c.name, slug: c.slug } : c)),
    variantCount: active.length, featured: p.featured,
  };
}

async function withVariants(products) {
  const vs = await Variant.find({ product: { $in: products.map((p) => p._id) }, isActive: true }).lean();
  const by = new Map();
  for (const v of vs) {
    const k = String(v.product);
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(v);
  }
  return products.map((p) => card(p, by.get(String(p._id)) || []));
}

export function listCategories() {
  return cached("categories", 60_000, async () => {
    const cats = await Category.find({ isActive: true }).sort({ position: 1, name: 1 }).lean();
    const counts = await Product.aggregate([{ $match: { status: "active" } }, { $unwind: "$categories" }, { $group: { _id: "$categories", n: { $sum: 1 } } }]);
    const cm = new Map(counts.map((c) => [String(c._id), c.n]));
    return cats.map((c) => ({ id: String(c._id), name: c.name, slug: c.slug, parent: c.parent ? String(c.parent) : null, productCount: cm.get(String(c._id)) || 0 }));
  });
}

export function listProducts(query = {}) {
  const key = `list:${JSON.stringify(query)}`;
  return cached(key, 30_000, async () => {
    const filter = { status: "active" };
    if (query.category) {
      const cat = await Category.findOne({ slug: query.category, isActive: true });
      if (!cat) return { items: [], total: 0, page: 1, pages: 0, facets: { brands: [] } };
      const children = await Category.find({ parent: cat._id }, { _id: 1 });
      filter.categories = { $in: [cat._id, ...children.map((c) => c._id)] };
    }
    if (query.q) {
      const rx = new RegExp(escapeRegex(String(query.q).slice(0, 80)), "i");
      filter.$or = [{ name: rx }, { brand: rx }];
    }
    if (query.brand) filter.brand = { $in: String(query.brand).split(",") };
    const min = Number(query.minPrice), max = Number(query.maxPrice);
    if (min > 0 || max > 0) filter.priceMin = { ...(min > 0 ? { $gte: min } : {}), ...(max > 0 ? { $lte: max } : {}) };
    if (query.featured === "true") filter.featured = true;
    if (query.exclude && mongoose.isValidObjectId(query.exclude)) filter._id = { $ne: new mongoose.Types.ObjectId(query.exclude) };
    if (query.inStock === "true") {
      const ids = await Variant.distinct("product", { isActive: true, $expr: { $gt: [{ $subtract: ["$onHand", "$reserved"] }, 0] } });
      filter.$and = [{ $or: [{ _id: { $in: ids } }, { allowBackorder: true }] }];
    }
    const sorts = { newest: { publishedAt: -1, createdAt: -1 }, price_asc: { priceMin: 1 }, price_desc: { priceMin: -1 }, name: { name: 1 }, featured: { featured: -1, publishedAt: -1 } };
    const limit = Math.min(Math.max(Number(query.limit) || 12, 1), 48);
    const page = Math.max(Number(query.page) || 1, 1);
    const [docs, total, brands] = await Promise.all([
      Product.find(filter).sort(sorts[query.sort] || sorts.featured).skip((page - 1) * limit).limit(limit).populate("categories", "name slug").lean(),
      Product.countDocuments(filter),
      Product.distinct("brand", { status: "active", brand: { $nin: [null, ""] } }),
    ]);
    return { items: await withVariants(docs), total, page, pages: Math.ceil(total / limit), facets: { brands: brands.sort() } };
  });
}

export function getProductBySlug(slug) {
  return cached(`product:${slug}`, 30_000, async () => {
    const p = await Product.findOne({ slug, status: "active" }).populate("categories", "name slug").lean();
    if (!p) throw notFound("Product not found");
    const variants = await Variant.find({ product: p._id, isActive: true }).sort({ position: 1 }).lean();
    const vs = variants.map((v) => {
      const available = Math.max(0, v.onHand - v.reserved);
      return {
        id: String(v._id), sku: v.sku, options: v.options || {}, label: variantLabel(v), price: v.price,
        compareAtPrice: v.compareAtPrice || null, image: v.image || null,
        available: p.allowBackorder ? null : available, inStock: p.allowBackorder || available > 0,
        stockLevel: p.allowBackorder && available <= 0 ? "backorder" : available <= 0 ? "out" : available <= v.lowStockThreshold ? "low" : "in",
      };
    });
    const images = sortImages(p.images).map((i) => ({ id: String(i._id), url: i.url, altText: i.altText || p.name, variant: i.variant ? String(i.variant) : null }));
    return {
      id: String(p._id), name: p.name, slug: p.slug, description: p.description, brand: p.brand,
      categories: p.categories.map((c) => ({ name: c.name, slug: c.slug })), options: p.options, images, variants: vs,
      priceMin: p.priceMin, priceMax: p.priceMax, allowBackorder: p.allowBackorder, taxClass: p.taxClass,
      weightGrams: p.weightGrams, seoTitle: p.seoTitle || p.name,
      seoDescription: p.seoDescription || String(p.description || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160),
    };
  });
}

export async function searchSuggest(q) {
  if (!q || q.length < 2) return [];
  const rx = new RegExp(escapeRegex(q.slice(0, 50)), "i");
  const docs = await Product.find({ status: "active", $or: [{ name: rx }, { brand: rx }] }).limit(6).lean();
  return (await withVariants(docs)).map(({ id, name, slug, image, priceMin }) => ({ id, name, slug, image, priceMin }));
}
