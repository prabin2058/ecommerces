import Variant, { variantLabel } from "../models/Variant.js";
import Product from "../models/Product.js";
import Coupon from "../models/Coupon.js";
import config from "../config.js";
import { formatMoney } from "./notificationService.js";

const VALLEY = ["kathmandu", "lalitpur", "bhaktapur", "patan", "kirtipur"];
const isValley = (city) => !city || VALLEY.some((c) => String(city).toLowerCase().includes(c));

export async function validateCoupon(code, subtotal) {
  if (!code) return { coupon: null };
  const c = await Coupon.findOne({ code: String(code).toUpperCase().trim() });
  const now = new Date();
  if (!c || !c.isActive) return { error: "This coupon code is not valid." };
  if (c.startsAt && c.startsAt > now) return { error: "This coupon is not active yet." };
  if (c.expiresAt && c.expiresAt < now) return { error: "This coupon has expired." };
  if (c.usageLimit !== null && c.usageLimit !== undefined && c.usedCount >= c.usageLimit) return { error: "This coupon has reached its usage limit." };
  if (c.minSpend && subtotal < c.minSpend) return { error: `Spend ${formatMoney(c.minSpend)} or more to use this coupon.`, coupon: c, belowMinimum: true };
  return { coupon: c };
}

function couponDiscount(c, subtotal) {
  if (!c) return 0;
  if (c.type === "percent") {
    const d = Math.floor((subtotal * c.value) / 100);
    return Math.min(d, c.maxDiscount || d);
  }
  if (c.type === "fixed") return Math.min(c.value, subtotal);
  return 0;
}

export function shippingMethods({ city, weightGrams, merchandiseTotal, freeShippingCoupon }) {
  const kgOver = Math.max(0, Math.ceil((weightGrams - 2000) / 1000));
  const valley = isValley(city);
  const freeStandard = freeShippingCoupon || merchandiseTotal >= config.checkout.freeShippingThreshold;
  return [
    {
      code: "standard", name: "Standard delivery",
      price: freeStandard ? 0 : (valley ? 10000 : 20000) + kgOver * 5000,
      eta: valley ? "2–3 business days" : "4–7 business days",
      free: freeStandard,
    },
    {
      code: "express", name: "Express delivery",
      price: (valley ? 25000 : 45000) + kgOver * 8000,
      eta: valley ? "Next business day" : "2–3 business days",
    },
  ];
}

/**
 * Re-price cart lines from the database. Never trusts client prices.
 * items: [{ _id?, variant, quantity, unitPriceAtAdd? }]
 */
export async function priceLines(items) {
  const ids = items.map((i) => i.variant);
  const variants = await Variant.find({ _id: { $in: ids } }).lean();
  const vmap = new Map(variants.map((v) => [String(v._id), v]));
  const products = await Product.find({ _id: { $in: variants.map((v) => v.product) } }).lean();
  const pmap = new Map(products.map((p) => [String(p._id), p]));
  const lines = [];
  for (const it of items) {
    const v = vmap.get(String(it.variant));
    const p = v && pmap.get(String(v.product));
    const issues = [];
    let blocking = false;
    if (!v || !p || p.status !== "active" || !v.isActive) {
      issues.push({ code: "UNAVAILABLE", message: "This item is no longer available." });
      blocking = true;
    }
    const available = v ? v.onHand - v.reserved : 0;
    const backorder = !!p?.allowBackorder;
    if (v && !blocking && !backorder) {
      if (available <= 0) {
        issues.push({ code: "OUT_OF_STOCK", message: "Out of stock." });
        blocking = true;
      } else if (it.quantity > available) {
        issues.push({ code: "INSUFFICIENT_STOCK", message: `Only ${available} left — reduce the quantity.`, available });
        blocking = true;
      }
    }
    if (it.quantity > config.cart.maxQtyPerLine) {
      issues.push({ code: "MAX_QTY", message: `Maximum ${config.cart.maxQtyPerLine} per item.` });
      blocking = true;
    }
    if (v && it.unitPriceAtAdd !== undefined && it.unitPriceAtAdd !== v.price && !blocking) {
      issues.push({
        code: "PRICE_CHANGED", previous: it.unitPriceAtAdd, current: v.price,
        message: `Price ${v.price > it.unitPriceAtAdd ? "increased" : "dropped"} from ${formatMoney(it.unitPriceAtAdd)} to ${formatMoney(v.price)}.`,
      });
      blocking = true;
    }
    const images = [...(p?.images || [])].sort((a, b) => a.position - b.position);
    const image = v?.image || images.find((im) => im.variant && String(im.variant) === String(v?._id))?.url || images[0]?.url || null;
    const unitPrice = v?.price ?? it.unitPriceAtAdd ?? 0;
    lines.push({
      id: it._id ? String(it._id) : undefined,
      variantId: String(it.variant),
      productId: p ? String(p._id) : null,
      name: p?.name || "Unavailable product",
      slug: p?.slug,
      options: v ? variantLabel(v) : "",
      optionMap: v?.options || {},
      sku: v?.sku,
      image,
      unitPrice,
      compareAtPrice: v?.compareAtPrice || null,
      quantity: it.quantity,
      lineTotal: unitPrice * it.quantity,
      available: backorder ? null : Math.max(0, available),
      backorder: backorder && available < it.quantity,
      allowBackorder: backorder,
      taxClass: p?.taxClass || "standard",
      weightGrams: v?.weightGrams ?? p?.weightGrams ?? 0,
      issues,
      blocking,
    });
  }
  return lines;
}

/** Full server-side quote: subtotal, discount, shipping, tax, total. */
export async function quote({ items, couponCode, address, shippingMethod }) {
  const lines = await priceLines(items);
  const valid = lines.filter((l) => !l.blocking || l.issues.every((i) => i.code === "PRICE_CHANGED"));
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const { coupon, error: couponError } = await validateCoupon(couponCode, subtotal);
  const usableCoupon = couponError ? null : coupon;
  const discount = couponDiscount(usableCoupon, subtotal);
  const weightGrams = valid.reduce((s, l) => s + (l.weightGrams || 0) * l.quantity, 0);
  const methods = shippingMethods({
    city: address?.city, weightGrams, merchandiseTotal: subtotal - discount, freeShippingCoupon: usableCoupon?.type === "free_shipping",
  });
  const method = methods.find((m) => m.code === shippingMethod) || methods[0];
  const shippingFee = lines.length ? method.price : 0;
  // Tax is exclusive, by tax class, on the discounted line amount.
  let tax = 0;
  for (const l of lines) {
    const share = subtotal ? Math.round((l.lineTotal / subtotal) * discount) : 0;
    tax += Math.round((l.lineTotal - share) * (config.tax[l.taxClass] ?? config.tax.standard));
  }
  const total = subtotal - discount + shippingFee + tax;
  const itemCount = lines.reduce((s, l) => s + l.quantity, 0);
  const issues = [];
  if (itemCount > config.cart.maxItemsPerOrder) issues.push({ code: "MAX_ITEMS", message: `Orders are limited to ${config.cart.maxItemsPerOrder} items.` });
  const threshold = config.checkout.freeShippingThreshold;
  return {
    lines,
    itemCount,
    subtotal,
    discount,
    coupon: coupon ? { code: coupon.code, type: coupon.type, value: coupon.value, description: coupon.description, error: couponError || null } : couponCode ? { code: couponCode, error: couponError } : null,
    shippingMethods: methods,
    shippingMethod: { code: method.code, name: method.name, eta: method.eta },
    shippingFee,
    shippingIsEstimate: !address?.city,
    tax,
    total,
    currency: config.currency,
    freeShipping: { threshold, remaining: Math.max(0, threshold - (subtotal - discount)), qualified: subtotal - discount >= threshold },
    issues,
    canCheckout: lines.length > 0 && !lines.some((l) => l.blocking) && !issues.length && !couponError,
  };
}
