import Variant from "../models/Variant.js";
import Product from "../models/Product.js";
import InventoryLog from "../models/InventoryLog.js";
import { adminAlert } from "./notificationService.js";
import { conflict, badRequest, notFound } from "../lib/errors.js";

async function log(v, { field = "onHand", change, reason, note, refType, refId, user }) {
  await InventoryLog.create({
    variant: v._id, product: v.product, sku: v.sku, field, change,
    after: field === "onHand" ? v.onHand : v.reserved, reason, note, refType, refId, user: user?.id,
  });
}

async function checkLowStock(v) {
  const available = v.onHand - v.reserved;
  if (available <= v.lowStockThreshold) {
    await adminAlert(
      available <= 0 ? `Out of stock: ${v.sku}` : `Low stock: ${v.sku}`,
      `${v.sku} has ${available} available (threshold ${v.lowStockThreshold}).`,
      {
        severity: available < 0 ? "critical" : "warning",
        // one alert per variant per stock level crossing
        dedupeKey: `lowstock:${v._id}:${available <= 0 ? "out" : "low"}:${v.updatedAt?.toISOString?.().slice(0, 13)}`,
        meta: { variantId: v._id, productId: v.product, available },
      }
    );
  }
}

// Manual / admin stock change. Never lets on_hand drop below what is reserved.
export async function adjustStock(variantId, delta, reason, { note, user, refType, refId } = {}) {
  delta = Number(delta);
  if (!Number.isInteger(delta) || delta === 0) throw badRequest("INVALID_QUANTITY", "Change must be a non-zero whole number");
  const filter = { _id: variantId };
  if (delta < 0) filter.$expr = { $gte: [{ $subtract: ["$onHand", "$reserved"] }, -delta] };
  const v = await Variant.findOneAndUpdate(filter, { $inc: { onHand: delta } }, { new: true });
  if (!v) {
    const exists = await Variant.findById(variantId);
    if (!exists) throw notFound("Variant not found");
    throw conflict("INSUFFICIENT_STOCK", `Only ${exists.onHand - exists.reserved} available to remove`, { available: exists.onHand - exists.reserved });
  }
  await log(v, { change: delta, reason, note, user, refType, refId });
  await checkLowStock(v);
  return v;
}

// Atomic conditional reservation: succeeds only if enough is available (unless backorders allowed).
export async function reserve(variantId, qty, { allowBackorder = false, orderId } = {}) {
  const filter = { _id: variantId, isActive: true };
  if (!allowBackorder) filter.$expr = { $gte: [{ $subtract: ["$onHand", "$reserved"] }, qty] };
  const v = await Variant.findOneAndUpdate(filter, { $inc: { reserved: qty } }, { new: true });
  if (v) await log(v, { field: "reserved", change: qty, reason: "reserve", refType: "order", refId: orderId });
  return v;
}

export async function release(variantId, qty, { orderId, reason = "release" } = {}) {
  if (!qty) return null;
  const v = await Variant.findOneAndUpdate({ _id: variantId, reserved: { $gte: qty } }, { $inc: { reserved: -qty } }, { new: true });
  if (v) await log(v, { field: "reserved", change: -qty, reason, refType: "order", refId: orderId });
  return v;
}

// Paid: convert reservation into a sale (on_hand -= qty, reserved -= qty).
export async function commitReserved(variantId, qty, { orderId } = {}) {
  const v = await Variant.findOneAndUpdate(
    { _id: variantId, reserved: { $gte: qty } },
    { $inc: { reserved: -qty, onHand: -qty } },
    { new: true }
  );
  if (v) {
    await log(v, { change: -qty, reason: "sale", refType: "order", refId: orderId });
    await checkLowStock(v);
  }
  return v;
}

// Sale without a reservation (e.g. reservation expired but payment arrived). Conditional.
export async function sellDirect(variantId, qty, { orderId, allowBackorder = false } = {}) {
  const filter = { _id: variantId };
  if (!allowBackorder) filter.$expr = { $gte: [{ $subtract: ["$onHand", "$reserved"] }, qty] };
  const v = await Variant.findOneAndUpdate(filter, { $inc: { onHand: -qty } }, { new: true });
  if (v) {
    await log(v, { change: -qty, reason: "sale", refType: "order", refId: orderId, note: "sold without active reservation" });
    await checkLowStock(v);
  }
  return v;
}

export async function restock(variantId, qty, { orderId, reason = "return", user } = {}) {
  const v = await Variant.findByIdAndUpdate(variantId, { $inc: { onHand: qty } }, { new: true });
  if (v) await log(v, { change: qty, reason, refType: "order", refId: orderId, user });
  return v;
}

// Keep product.priceMin/priceMax in sync with its active variants.
export async function syncProductPrices(productId) {
  const vs = await Variant.find({ product: productId, isActive: true }, { price: 1 });
  const prices = vs.map((v) => v.price);
  await Product.updateOne(
    { _id: productId },
    prices.length ? { priceMin: Math.min(...prices), priceMax: Math.max(...prices) } : { $unset: { priceMin: 1, priceMax: 1 } }
  );
}
