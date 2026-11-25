import Cart from "../models/Cart.js";
import Variant from "../models/Variant.js";
import Product from "../models/Product.js";
import Event from "../models/Event.js";
import config from "../config.js";
import { quote, validateCoupon } from "./pricingService.js";
import { parseCookies, randomToken } from "../lib/util.js";
import { badRequest, conflict, notFound } from "../lib/errors.js";
import mongoose from "mongoose";

export const CART_COOKIE = "cart_session";
const cookieOpts = () => ({ httpOnly: true, secure: config.isProd, sameSite: "lax", path: "/", maxAge: config.cart.guestTtlDays * 86400_000 });
const guestExpiry = () => new Date(Date.now() + config.cart.guestTtlDays * 86400_000);

export const visitorId = (req) => req.user?.id || parseCookies(req.headers.cookie)[CART_COOKIE] || req.ip;

export async function track(req, type, extra = {}) {
  Event.create({ type, visitor: visitorId(req), ...extra }).catch(() => {});
}

export async function findCart(req) {
  if (req.user?.id) return Cart.findOne({ user: req.user.id, status: "active" });
  const token = parseCookies(req.headers.cookie)[CART_COOKIE];
  if (!token) return null;
  return Cart.findOne({ sessionToken: token, user: null, status: "active" });
}

export async function getOrCreateCart(req, res) {
  let cart = await findCart(req);
  if (cart) return cart;
  if (req.user?.id) {
    try {
      return await Cart.create({ user: req.user.id, items: [] });
    } catch (e) {
      if (e.code === 11000) return Cart.findOne({ user: req.user.id, status: "active" });
      throw e;
    }
  }
  const token = randomToken(24);
  cart = await Cart.create({ sessionToken: token, items: [], expiresAt: guestExpiry() });
  res.cookie(CART_COOKIE, token, cookieOpts());
  return cart;
}

async function touch(cart, res) {
  cart.lastActivityAt = new Date();
  cart.remindersSent = 0;
  if (!cart.user) {
    cart.expiresAt = guestExpiry();
    if (res) res.cookie(CART_COOKIE, cart.sessionToken, cookieOpts());
  }
  await cart.save();
}

export async function cartView(cart, opts = {}) {
  if (!cart) {
    const empty = await quote({ items: [] });
    return { cartId: null, ...empty, items: [], saved: [] };
  }
  const q = await quote({ items: cart.items, couponCode: cart.couponCode, ...opts });
  const savedVariants = cart.savedItems.length ? await Variant.find({ _id: { $in: cart.savedItems.map((s) => s.variant) } }).lean() : [];
  const savedProducts = await Product.find({ _id: { $in: savedVariants.map((v) => v.product) } }).lean();
  const pm = new Map(savedProducts.map((p) => [String(p._id), p]));
  const saved = savedVariants.map((v) => {
    const p = pm.get(String(v.product));
    const img = [...(p?.images || [])].sort((a, b) => a.position - b.position)[0]?.url;
    return {
      variantId: String(v._id), name: p?.name, slug: p?.slug, image: v.image || img, price: v.price,
      options: Object.values(v.options || {}).join(" / "), available: p?.status === "active" && v.isActive && (p.allowBackorder || v.onHand - v.reserved > 0),
    };
  });
  const { lines, ...rest } = q;
  return { cartId: String(cart._id), ...rest, items: lines, saved, email: cart.email || null };
}

async function loadVariantForCart(variantId) {
  if (!mongoose.isValidObjectId(variantId)) throw badRequest("INVALID_VARIANT", "Choose a valid option");
  const v = await Variant.findById(variantId);
  if (!v || !v.isActive) throw notFound("This option is not available");
  const p = await Product.findById(v.product);
  if (!p || p.status !== "active") throw conflict("PRODUCT_UNAVAILABLE", "This product is not available");
  return { v, p };
}

function checkQty(qty) {
  if (!Number.isInteger(qty) || qty < 1) throw badRequest("INVALID_QUANTITY", "Quantity must be at least 1");
  if (qty > config.cart.maxQtyPerLine) throw badRequest("MAX_QTY", `You can add up to ${config.cart.maxQtyPerLine} of each item`, { max: config.cart.maxQtyPerLine });
}

function checkStock(v, p, wanted) {
  const available = v.onHand - v.reserved;
  if (!p.allowBackorder && wanted > available)
    throw conflict("INSUFFICIENT_STOCK", available > 0 ? `Only ${available} available` : "This item is out of stock", { available: Math.max(0, available) });
}

function checkOrderLimit(cart, extra) {
  const count = cart.items.reduce((s, i) => s + i.quantity, 0) + extra;
  if (count > config.cart.maxItemsPerOrder) throw badRequest("MAX_ITEMS", `A cart can hold up to ${config.cart.maxItemsPerOrder} items`);
}

export async function addItem(req, res, { variantId, quantity = 1 }) {
  quantity = Number(quantity);
  checkQty(quantity);
  const { v, p } = await loadVariantForCart(variantId);
  const cart = await getOrCreateCart(req, res);
  const line = cart.items.find((i) => String(i.variant) === String(v._id));
  const newQty = (line?.quantity || 0) + quantity;
  if (newQty > config.cart.maxQtyPerLine) throw badRequest("MAX_QTY", `You can have up to ${config.cart.maxQtyPerLine} of this item in your cart`, { max: config.cart.maxQtyPerLine });
  checkStock(v, p, newQty);
  checkOrderLimit(cart, quantity);
  // Same variant -> bump quantity on the existing line instead of a second line.
  if (line) {
    line.quantity = newQty;
    line.unitPriceAtAdd = v.price;
  } else cart.items.push({ variant: v._id, quantity, unitPriceAtAdd: v.price });
  cart.savedItems = cart.savedItems.filter((s) => String(s.variant) !== String(v._id));
  await touch(cart, res);
  track(req, "add_to_cart", { product: p._id, value: v.price * quantity });
  return cartView(cart);
}

async function cartWithLine(req, itemId) {
  const cart = await findCart(req);
  if (!cart) throw notFound("Cart not found");
  const line = cart.items.id(itemId);
  if (!line) throw notFound("Item not in cart");
  return { cart, line };
}

export async function updateItem(req, res, itemId, { quantity }) {
  quantity = Number(quantity);
  checkQty(quantity);
  const { cart, line } = await cartWithLine(req, itemId);
  const v = await Variant.findById(line.variant);
  const p = v && (await Product.findById(v.product));
  if (!v || !p) throw conflict("PRODUCT_UNAVAILABLE", "This item is no longer available");
  if (quantity > line.quantity) checkStock(v, p, quantity);
  checkOrderLimit(cart, quantity - line.quantity);
  line.quantity = quantity;
  await touch(cart, res);
  return cartView(cart);
}

export async function removeItem(req, res, itemId) {
  const { cart, line } = await cartWithLine(req, itemId);
  line.deleteOne();
  await touch(cart, res);
  return cartView(cart);
}

export async function acceptPrice(req, res, itemId) {
  const { cart, line } = await cartWithLine(req, itemId);
  const v = await Variant.findById(line.variant);
  if (v) line.unitPriceAtAdd = v.price;
  await touch(cart, res);
  return cartView(cart);
}

export async function saveForLater(req, res, itemId) {
  const { cart, line } = await cartWithLine(req, itemId);
  if (!cart.savedItems.some((s) => String(s.variant) === String(line.variant))) cart.savedItems.push({ variant: line.variant, savedAt: new Date() });
  line.deleteOne();
  await touch(cart, res);
  return cartView(cart);
}

export async function moveToCart(req, res, variantId) {
  const cart = await findCart(req);
  if (!cart) throw notFound("Cart not found");
  const view = await addItem(req, res, { variantId, quantity: 1 });
  return view;
}

export async function removeSaved(req, res, variantId) {
  const cart = await findCart(req);
  if (!cart) throw notFound("Cart not found");
  cart.savedItems = cart.savedItems.filter((s) => String(s.variant) !== String(variantId));
  await touch(cart, res);
  return cartView(cart);
}

export async function applyCoupon(req, res, code) {
  const cart = await findCart(req);
  if (!cart || !cart.items.length) throw badRequest("CART_EMPTY", "Add items before applying a coupon");
  const view = await cartView(cart);
  const { error } = await validateCoupon(code, view.subtotal);
  if (error) throw badRequest("INVALID_COUPON", error);
  cart.couponCode = String(code).toUpperCase().trim();
  await touch(cart, res);
  return cartView(cart);
}

export async function removeCoupon(req, res) {
  const cart = await findCart(req);
  if (!cart) throw notFound("Cart not found");
  cart.couponCode = null;
  await touch(cart, res);
  return cartView(cart);
}

// Guest cart -> user cart on login: sum quantities per variant, cap at stock and line max.
export async function mergeGuestCartIntoUser(req, res, userId) {
  const token = parseCookies(req.headers.cookie)[CART_COOKIE];
  if (!token) return null;
  const guest = await Cart.findOne({ sessionToken: token, user: null, status: "active" });
  res.clearCookie(CART_COOKIE, { path: "/" });
  if (!guest || (!guest.items.length && !guest.savedItems.length)) {
    if (guest) await guest.deleteOne();
    return null;
  }
  let userCart = await Cart.findOne({ user: userId, status: "active" });
  if (!userCart) userCart = new Cart({ user: userId, items: [] });
  const adjustments = [];
  for (const gi of guest.items) {
    const v = await Variant.findById(gi.variant);
    const p = v && (await Product.findById(v.product));
    if (!v || !p || p.status !== "active" || !v.isActive) continue;
    const existing = userCart.items.find((i) => String(i.variant) === String(gi.variant));
    const wanted = (existing?.quantity || 0) + gi.quantity;
    const cap = Math.min(config.cart.maxQtyPerLine, p.allowBackorder ? Infinity : Math.max(0, v.onHand - v.reserved));
    const qty = Math.min(wanted, cap);
    if (qty < wanted) adjustments.push({ sku: v.sku, requested: wanted, kept: qty });
    if (qty <= 0) continue;
    if (existing) existing.quantity = qty;
    else userCart.items.push({ variant: gi.variant, quantity: qty, unitPriceAtAdd: gi.unitPriceAtAdd });
  }
  for (const s of guest.savedItems) if (!userCart.savedItems.some((x) => String(x.variant) === String(s.variant))) userCart.savedItems.push(s);
  if (!userCart.couponCode && guest.couponCode) userCart.couponCode = guest.couponCode;
  userCart.lastActivityAt = new Date();
  await userCart.save();
  await guest.deleteOne();
  return { merged: true, adjustments };
}

export async function setCartEmail(cart, email) {
  if (cart && email && cart.email !== email) {
    cart.email = email;
    await cart.save();
  }
}
