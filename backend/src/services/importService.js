import Product from "../models/Product.js";
import Variant from "../models/Variant.js";
import Category from "../models/Category.js";
import { parseCsv, toCsv } from "../lib/csv.js";
import { rupeesToPaisa, slugify, uniqueSlug } from "../lib/util.js";
import { sanitizeDescription } from "../lib/sanitize.js";
import { adjustStock, syncProductPrices } from "./inventoryService.js";
import { audit } from "./auditService.js";
import { invalidateCatalog } from "../lib/cache.js";

export const CSV_HEADERS = ["handle", "name", "description", "categories", "brand", "status", "tax_class", "sku", "price", "compare_at_price",
  "cost_price", "stock", "option1_name", "option1_value", "option2_name", "option2_value", "option3_name", "option3_value", "image_urls", "weight_grams"];

// Rows sharing a `handle` are variants of one product. Product-level fields are read from the first row.
export async function importCsv(text, { dryRun = true, user }) {
  const { headers, records } = parseCsv(text);
  const missing = ["handle", "name", "sku", "price"].filter((h) => !headers.includes(h));
  if (missing.length) return { dryRun, ok: false, fatal: `Missing required columns: ${missing.join(", ")}`, rows: [] };

  const categories = await Category.find({});
  const catBy = new Map();
  for (const c of categories) {
    catBy.set(c.slug, c);
    catBy.set(c.name.toLowerCase(), c);
  }
  const seenSku = new Set();
  const rows = [];
  const groups = new Map();
  for (const [i, r] of records.entries()) {
    const rowNo = i + 2;
    const errors = [];
    const handle = slugify(r.handle || r.name);
    if (!handle) errors.push("handle or name is required");
    const sku = String(r.sku || "").toUpperCase().trim();
    if (!sku) errors.push("sku is required");
    else if (seenSku.has(sku)) errors.push(`duplicate sku ${sku} in file`);
    seenSku.add(sku);
    const price = rupeesToPaisa(r.price);
    if (!(price > 0)) errors.push("price must be a number greater than 0");
    const compare = rupeesToPaisa(r.compare_at_price);
    if (Number.isNaN(compare)) errors.push("compare_at_price must be a number");
    else if (compare && compare <= price) errors.push("compare_at_price must be greater than price");
    const cost = rupeesToPaisa(r.cost_price);
    if (Number.isNaN(cost)) errors.push("cost_price must be a number");
    const stock = r.stock === "" || r.stock === undefined ? 0 : Number(r.stock);
    if (!Number.isInteger(stock) || stock < 0) errors.push("stock must be a whole number ≥ 0");
    const status = (r.status || "draft").toLowerCase();
    if (!["draft", "active", "archived"].includes(status)) errors.push("status must be draft, active or archived");
    const tax = (r.tax_class || "standard").toLowerCase();
    if (!["standard", "reduced", "exempt"].includes(tax)) errors.push("tax_class must be standard, reduced or exempt");
    const cats = String(r.categories || "").split(/[;|]/).map((s) => s.trim()).filter(Boolean);
    const catIds = [];
    for (const c of cats) {
      const hit = catBy.get(slugify(c)) || catBy.get(c.toLowerCase());
      if (!hit) errors.push(`unknown category "${c}"`);
      else catIds.push(hit._id);
    }
    const options = {};
    for (const n of [1, 2, 3]) {
      const name = r[`option${n}_name`], val = r[`option${n}_value`];
      if (name && val) options[name.trim()] = val.trim();
      else if (name || val) errors.push(`option${n}_name and option${n}_value go together`);
    }
    const existingSku = sku ? await Variant.findOne({ sku }).populate("product", "slug") : null;
    if (existingSku && existingSku.product?.slug !== handle) errors.push(`sku ${sku} already belongs to product "${existingSku.product?.slug}"`);
    const parsed = { rowNo, handle, sku, price, compare, cost, stock, status, tax, catIds, options, row: r, existingSku };
    rows.push({ row: rowNo, handle, sku, errors, action: errors.length ? "error" : existingSku ? "update" : "create" });
    if (!errors.length) {
      if (!groups.has(handle)) groups.set(handle, []);
      groups.get(handle).push(parsed);
    }
  }
  const errorCount = rows.filter((r) => r.errors.length).length;
  const summary = { rows: rows.length, errors: errorCount, products: groups.size, variants: rows.length - errorCount };
  if (dryRun || errorCount) return { dryRun, ok: errorCount === 0, summary, rows };

  for (const [handle, items] of groups) {
    const first = items[0];
    const r = first.row;
    let p = await Product.findOne({ slug: handle });
    const optionNames = [...new Set(items.flatMap((it) => Object.keys(it.options)))];
    const options = optionNames.map((name) => ({ name, values: [...new Set(items.map((it) => it.options[name]).filter(Boolean))] }));
    const images = String(r.image_urls || "").split(/[;|\s]+/).filter((u) => /^https:\/\/|^\/images\//.test(u));
    const fields = {
      name: r.name || handle, description: sanitizeDescription(r.description || ""), brand: r.brand || undefined,
      categories: first.catIds, taxClass: first.tax, basePrice: first.price, compareAtPrice: first.compare || undefined,
      costPrice: first.cost || undefined, options, weightGrams: Number(r.weight_grams) || 0,
    };
    if (!p) {
      p = await Product.create({
        ...fields, slug: await uniqueSlug(Product, handle), status: "draft", createdBy: user.id,
        images: images.map((url, position) => ({ url, altText: fields.name, position })),
      });
    } else {
      p.set(fields);
      if (images.length && !p.images.length) p.images = images.map((url, position) => ({ url, altText: fields.name, position }));
      await p.save();
    }
    for (const [i, it] of items.entries()) {
      let v = it.existingSku;
      if (!v) {
        v = await Variant.create({ product: p._id, sku: it.sku, options: it.options, price: it.price, compareAtPrice: it.compare || undefined, costPrice: it.cost || undefined, position: i, isDefault: !Object.keys(it.options).length });
        if (it.stock) await adjustStock(v._id, it.stock, "import", { user, note: `CSV row ${it.rowNo}` });
      } else {
        await Variant.updateOne({ _id: v._id }, { options: it.options, price: it.price, compareAtPrice: it.compare || undefined, costPrice: it.cost || undefined, isActive: true, position: i });
        const delta = it.stock - v.onHand;
        if (delta && v.onHand - v.reserved + delta >= 0) await adjustStock(v._id, delta, "import", { user, note: `CSV row ${it.rowNo}` });
      }
    }
    await syncProductPrices(p._id);
    const wantStatus = first.status;
    if (wantStatus !== p.status) {
      if (wantStatus === "active") {
        const { publishIssues } = await import("./productAdminService.js");
        const issues = await publishIssues(await Product.findById(p._id));
        if (!issues.length) await Product.updateOne({ _id: p._id }, { status: "active", publishedAt: new Date() });
        else rows.filter((x) => x.handle === handle).forEach((x) => x.warnings = [`kept as draft: ${issues.join("; ")}`]);
      } else await Product.updateOne({ _id: p._id }, { status: wantStatus });
    }
  }
  await audit(user, "product", "import", "csv_import", [{ field: "rows", old: null, new: summary }]);
  invalidateCatalog();
  return { dryRun: false, ok: true, summary, rows };
}

export async function exportCsv() {
  const products = await Product.find({}).populate("categories", "slug").sort({ createdAt: 1 });
  const out = [];
  for (const p of products) {
    const vs = await Variant.find({ product: p._id, isActive: true }).sort({ position: 1 });
    for (const [i, v] of vs.entries()) {
      const opts = Object.entries(v.options instanceof Map ? Object.fromEntries(v.options) : v.options || {});
      const row = {
        handle: p.slug, name: p.name, sku: v.sku, price: v.price / 100,
        compare_at_price: v.compareAtPrice ? v.compareAtPrice / 100 : "", cost_price: v.costPrice ? v.costPrice / 100 : "",
        stock: v.onHand,
      };
      if (i === 0) Object.assign(row, {
        description: p.description, categories: p.categories.map((c) => c.slug).join(";"), brand: p.brand || "",
        status: p.status, tax_class: p.taxClass, image_urls: p.images.map((im) => im.url).join(";"), weight_grams: p.weightGrams || "",
      });
      opts.forEach(([name, value], n) => {
        row[`option${n + 1}_name`] = name;
        row[`option${n + 1}_value`] = value;
      });
      out.push(row);
    }
  }
  return toCsv(CSV_HEADERS, out);
}
