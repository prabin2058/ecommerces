// Seed demo catalog, coupons and staff accounts.  Usage: node scripts/seed.js [--reset]
import fs from "fs/promises";
import path from "path";
import url from "url";
import crypto from "crypto";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import config from "../src/config.js";
import Category from "../src/models/Category.js";
import Product from "../src/models/Product.js";
import Variant from "../src/models/Variant.js";
import Coupon from "../src/models/Coupon.js";
import User from "../src/models/User.js";
import InventoryLog from "../src/models/InventoryLog.js";
import { syncProductPrices } from "../src/services/inventoryService.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const reset = process.argv.includes("--reset");
const imagesOnly = process.argv.includes("--images");

// Product photos from Unsplash (free to use under the Unsplash License), served from their CDN.
const unsplash = (id) => `https://images.unsplash.com/photo-${id}?w=1200&q=80&auto=format&fit=crop`;
const productImages = (p) =>
  p.photos.map((id, position) => ({ url: unsplash(id), altText: `${p.name}${position ? " — alternate view" : ""}`, position }));


const rs = (n) => Math.round(n * 100);

const CATEGORIES = [
  { name: "Clothing", slug: "clothing", children: [{ name: "T-shirts", slug: "t-shirts" }, { name: "Hoodies", slug: "hoodies" }] },
  { name: "Electronics", slug: "electronics", children: [{ name: "Audio", slug: "audio" }, { name: "Wearables", slug: "wearables" }] },
  { name: "Home & Living", slug: "home-living" },
  { name: "Accessories", slug: "accessories" },
  { name: "Footwear", slug: "footwear" },
];

const PRODUCTS = [
  { name: "Everyday Cotton T-shirt", photos: ["1521572163474-6864f9cf17ab", "1583743814966-8936f5b7be1a"], cats: ["clothing", "t-shirts"], brand: "Prabin Basics", price: 1200, compare: 1500, cost: 550, weight: 220, featured: true,
    options: [{ name: "Size", values: ["S", "M", "L", "XL"] }, { name: "Color", values: ["Black", "White", "Navy"] }], stock: 12,
    desc: "<p>A soft, breathable 180 GSM combed-cotton tee with a relaxed fit. Pre-shrunk so it keeps its shape wash after wash.</p><ul><li>100% combed cotton</li><li>Ribbed crew neck</li><li>Machine washable</li></ul>" },
  { name: "Heavyweight Fleece Hoodie", photos: ["1556821840-3a63f95609a7", "1620799140408-edc6dcb6d633"], cats: ["clothing", "hoodies"], brand: "Prabin Basics", price: 3800, compare: 4500, cost: 1800, weight: 650, featured: true,
    options: [{ name: "Size", values: ["S", "M", "L", "XL"] }, { name: "Color", values: ["Charcoal", "Olive"] }], stock: 6,
    desc: "<p>Brushed-back fleece hoodie built for Kathmandu winters. Double-lined hood and a kangaroo pocket.</p>" },
  { name: "Linen Button-down Shirt", photos: ["1596755094514-f87e34085b2c", "1602810318383-e386cc2a3ccf"], cats: ["clothing"], brand: "Himal Thread", price: 2900, cost: 1300, weight: 260,
    options: [{ name: "Size", values: ["M", "L", "XL"] }], stock: 8, desc: "<p>Light linen-cotton blend shirt for warm days. Garment-washed for a lived-in feel.</p>" },
  { name: "Wireless Noise-cancelling Headphones", photos: ["1505740420928-5e560c06d30e", "1546435770-a3e426bf472b"], cats: ["electronics", "audio"], brand: "Sonora", price: 14500, compare: 17999, cost: 9000, weight: 300, featured: true,
    options: [{ name: "Color", values: ["Matte Black", "Silver"] }], stock: 5,
    desc: "<p>Active noise cancelling, 35-hour battery and fast USB-C charging. Folds flat for travel.</p><ul><li>Bluetooth 5.3</li><li>Multipoint pairing</li><li>Built-in mic for calls</li></ul>" },
  { name: "Portable Bluetooth Speaker", photos: ["1608043152269-423dbba4e7e1", "1589003077984-894e133dabab"], cats: ["electronics", "audio"], brand: "Sonora", price: 5200, cost: 3000, weight: 540,
    options: [{ name: "Color", values: ["Blue", "Red", "Black"] }], stock: 10, desc: "<p>Waterproof (IPX7) speaker with deep bass and 12 hours of playtime.</p>" },
  { name: "Smart Fitness Watch", photos: ["1579586337278-3befd40fd17a", "1546868871-7041f2a55e12"], cats: ["electronics", "wearables"], brand: "Pulse", price: 8900, compare: 9900, cost: 5200, weight: 60, featured: true,
    options: [{ name: "Strap", values: ["Black", "Sand", "Teal"] }], stock: 4, desc: "<p>Heart-rate, SpO2, sleep tracking and 7-day battery. Works with Android and iOS.</p>" },
  { name: "Phone Stand & Charger", photos: ["1583863788434-e58a36330cf0", "1586953208448-b95a79798f07"], cats: ["electronics"], brand: "Pulse", price: 2400, cost: 1100, weight: 180, options: [], stock: 25, desc: "<p>15W wireless charging stand that holds your phone upright in portrait or landscape.</p>" },
  { name: "Handmade Ceramic Mug", photos: ["1514228742587-6b1558fcca3d", "1495474472287-4d71bcdd2085"], cats: ["home-living"], brand: "Bhaktapur Pottery", price: 850, cost: 300, weight: 380, featured: true,
    options: [{ name: "Glaze", values: ["Sky", "Clay", "Moss"] }], stock: 20, taxClass: "reduced",
    desc: "<p>Wheel-thrown by potters in Bhaktapur. Each glaze is a little different — that's the point.</p>" },
  { name: "Brass Table Lamp", photos: ["1543198126-a8ad8e47fb22", "1507473885765-e6ed057f782c"], cats: ["home-living"], brand: "Patan Metalworks", price: 6500, cost: 3200, weight: 1800, options: [], stock: 3, desc: "<p>Hand-finished brass lamp with a warm linen shade. E27 bulb, not included.</p>" },
  { name: "Indoor Plant Pot Set", photos: ["1463320898484-cdee8141c787", "1485955900006-10f4d324d411"], cats: ["home-living"], brand: "Green Corner", price: 1900, cost: 800, weight: 2400, options: [{ name: "Size", values: ["Small", "Medium"] }], stock: 9, desc: "<p>Set of three matte ceramic pots with drainage holes and bamboo saucers.</p>" },
  { name: "Soy Wax Candle", photos: ["1602874801007-bd458bb1b8b6", "1572726729207-a78d6feb18d7"], cats: ["home-living"], brand: "Green Corner", price: 1100, cost: 400, weight: 300, options: [{ name: "Scent", values: ["Sandalwood", "Lemongrass", "Rose"] }], stock: 15, desc: "<p>Clean-burning soy candle in a reusable glass jar. Around 40 hours burn time.</p>" },
  { name: "Canvas Daypack", photos: ["1622560480605-d83c853bc5c3", "1553062407-98eeb64c6a62"], cats: ["accessories"], brand: "Trail & Co", price: 4200, compare: 4800, cost: 2000, weight: 700, featured: true,
    options: [{ name: "Color", values: ["Khaki", "Black"] }], stock: 7, desc: "<p>Waxed-canvas backpack with a padded 15\" laptop sleeve and leather trim.</p>" },
  { name: "Polarized Sunglasses", photos: ["1572635196237-14b3f281503f", "1511499767150-a48a237f0083"], cats: ["accessories"], brand: "Trail & Co", price: 2600, cost: 900, weight: 40, options: [], stock: 2, desc: "<p>UV400 polarized lenses in a lightweight acetate frame. Comes with a hard case.</p>" },
  { name: "Insulated Steel Bottle", photos: ["1602143407151-7111542de6e8", "1625708458528-802ec79b1ed8"], cats: ["accessories"], brand: "Trail & Co", price: 1600, cost: 700, weight: 350, options: [{ name: "Size", values: ["500 ml", "750 ml"] }], stock: 30, desc: "<p>Keeps drinks cold for 24 hours or hot for 12. Leak-proof lid.</p>" },
  { name: "Everyday Running Sneakers", photos: ["1595950653106-6c9ebd614d3a", "1600185365483-26d7a4cc7519"], cats: ["footwear"], brand: "Stride", price: 6800, compare: 7900, cost: 3600, weight: 800, featured: true,
    options: [{ name: "Size", values: ["40", "41", "42", "43", "44"] }], stock: 4, desc: "<p>Lightweight mesh runners with a responsive foam sole for daily miles.</p>" },
  { name: "Limited Edition Dhaka Topi", photos: ["1521369909029-2afed882baee", "1588850561407-ed78c282e89b"], cats: ["accessories"], brand: "Himal Thread", price: 950, cost: 400, weight: 80, options: [], stock: 0, desc: "<p>Hand-woven Palpali Dhaka topi. Currently sold out — restocking soon.</p>" },
];

const combos = (options) => options.reduce((acc, o) => acc.flatMap((c) => o.values.map((v) => ({ ...c, [o.name]: v }))), [{}]);
const skuPart = (s) => String(s).toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 6);

async function main() {
  await mongoose.connect(config.mongoUri);
  if (imagesOnly) {
    let n = 0;
    for (const p of PRODUCTS) {
      const slug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-$/, "");
      const r = await Product.updateOne({ slug }, { images: productImages(p) });
      n += r.modifiedCount;
    }
    console.log(`Updated photos on ${n} products.`);
    await mongoose.disconnect();
    return;
  }
  if (await Product.estimatedDocumentCount()) {
    if (!reset) {
      console.log("Catalog already has products. Run with --reset to wipe catalog/coupons and reseed.");
      process.exit(0);
    }
    await Promise.all([Product.deleteMany({}), Variant.deleteMany({}), Category.deleteMany({}), Coupon.deleteMany({}), InventoryLog.deleteMany({})]);
  }
  await Promise.all([Product.syncIndexes(), Variant.syncIndexes(), Category.syncIndexes(), Coupon.syncIndexes(), User.syncIndexes()]);

  const catBySlug = {};
  for (const [i, c] of CATEGORIES.entries()) {
    const parent = await Category.create({ name: c.name, slug: c.slug, position: i });
    catBySlug[c.slug] = parent;
    for (const [j, ch] of (c.children || []).entries()) catBySlug[ch.slug] = await Category.create({ name: ch.name, slug: ch.slug, parent: parent._id, position: j });
  }

  for (const [i, p] of PRODUCTS.entries()) {
    const slug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-$/, "");
    const prod = await Product.create({
      name: p.name, slug, description: p.desc, brand: p.brand, categories: p.cats.map((s) => catBySlug[s]._id),
      basePrice: rs(p.price), compareAtPrice: p.compare ? rs(p.compare) : undefined, costPrice: rs(p.cost), taxClass: p.taxClass || "standard",
      status: "active", publishedAt: new Date(Date.now() - (PRODUCTS.length - i) * 3600_000), options: p.options, featured: !!p.featured,
      weightGrams: p.weight, images: productImages(p),
    });
    const prefix = skuPart(slug.split("-").map((w) => w[0]).join("")) + String(i + 1).padStart(2, "0");
    for (const [k, combo] of combos(p.options).entries()) {
      const vals = Object.values(combo);
      const sku = [prefix, ...vals.map(skuPart)].join("-");
      // Vary stock a bit across variants; a couple of variants deliberately low/out.
      const onHand = p.stock === 0 ? 0 : Math.max(0, p.stock - (k % 4) * 2 + (k === 2 ? -p.stock : 0));
      const price = rs(p.price + (combo.Size === "XL" || combo.Size === "750 ml" ? (p.price > 2000 ? 300 : 200) : 0));
      const v = await Variant.create({ product: prod._id, sku, options: combo, price, compareAtPrice: p.compare ? rs(p.compare) + (price - rs(p.price)) : undefined, costPrice: rs(p.cost), position: k, isDefault: !vals.length, onHand, lowStockThreshold: 3 });
      if (onHand) await InventoryLog.create({ variant: v._id, product: prod._id, sku, change: onHand, after: onHand, reason: "initial", note: "seed" });
    }
    await syncProductPrices(prod._id);
  }

  const day = 86400_000;
  await Coupon.insertMany([
    { code: "WELCOME10", description: "10% off your first order (max Rs 1,000)", type: "percent", value: 10, maxDiscount: rs(1000), minSpend: rs(1000) },
    { code: "FLAT500", description: "Rs 500 off orders over Rs 5,000", type: "fixed", value: rs(500), minSpend: rs(5000), usageLimit: 100 },
    { code: "FREESHIP", description: "Free standard delivery", type: "free_shipping" },
    { code: "DASHAIN25", description: "Festival 25% off (expired)", type: "percent", value: 25, expiresAt: new Date(Date.now() - day) },
    { code: "ONCE", description: "Single-use test coupon", type: "fixed", value: rs(200), usageLimit: 1 },
  ]);

  // Staff accounts — passwords are generated and written to ../ecommerces/test-account.local (git-ignored).
  const accountsFile = path.join(__dirname, "../../test-account.local") // repo root;
  let existing = "";
  try { existing = await fs.readFile(accountsFile, "utf8"); } catch { /* none yet */ }
  const lines = [];
  for (const [role, email, name] of [["ADMIN", "admin@store.test", "Store Admin"], ["CATALOG_MANAGER", "catalog@store.test", "Catalog Manager"]]) {
    if (await User.exists({ email })) continue;
    const password = crypto.randomBytes(9).toString("base64url");
    await User.create({ name, email, password: bcrypt.hashSync(password), roles: ["USER", role] });
    lines.push(`${role}_EMAIL=${email}`, `${role}_PASSWORD=${password}`);
  }
  if (lines.length) await fs.writeFile(accountsFile, `${existing.trimEnd()}\n\n# Seeded staff accounts (scripts/seed.js)\n${lines.join("\n")}\n`);

  console.log(`Seeded ${await Category.countDocuments()} categories, ${await Product.countDocuments()} products, ${await Variant.countDocuments()} variants, ${await Coupon.countDocuments()} coupons.`);
  if (lines.length) console.log(`Staff credentials written to ${accountsFile}`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
