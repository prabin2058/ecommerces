import { api, authApi } from "@store/shared";

export { authApi };

const d = (p) => p.then((r) => r.data);

export const catalogApi = {
  list: (params) => d(api.get("/products", { params })),
  categories: () => d(api.get("/products/categories")),
  bySlug: (slug) => d(api.get(`/products/${encodeURIComponent(slug)}`)),
  suggest: (q) => d(api.get("/products/suggest", { params: { q } })),
};

export const cartApi = {
  get: () => d(api.get("/cart")),
  add: (variantId, quantity) => d(api.post("/cart/items", { variantId, quantity })),
  update: (id, quantity) => d(api.patch(`/cart/items/${id}`, { quantity })),
  remove: (id) => d(api.delete(`/cart/items/${id}`)),
  acceptPrice: (id) => d(api.post(`/cart/items/${id}/accept-price`)),
  saveForLater: (id) => d(api.post(`/cart/items/${id}/save-for-later`)),
  moveToCart: (variantId) => d(api.post(`/cart/saved/${variantId}/move-to-cart`)),
  removeSaved: (variantId) => d(api.delete(`/cart/saved/${variantId}`)),
  applyCoupon: (code) => d(api.post("/cart/coupon", { code })),
  removeCoupon: () => d(api.delete("/cart/coupon")),
};

export const checkoutApi = {
  start: () => d(api.post("/checkout/start")),
  rates: (address) => d(api.post("/checkout/shipping-rates", { address })),
  validate: (body) => d(api.post("/checkout/validate", body)),
  placeOrder: (body, key) => d(api.post("/checkout/place-order", body, { headers: { "Idempotency-Key": key } })),
};

export const ordersApi = {
  get: (number, t, sync) => d(api.get(`/orders/${number}`, { params: { t, sync: sync ? 1 : undefined } })),
  pay: (number, t, method) => d(api.post(`/orders/${number}/pay`, { t, method })),
  cancel: (number, t) => d(api.post(`/orders/${number}/cancel`, { t })),
};

export const accountApi = {
  orders: () => d(api.get("/account/orders")),
  addresses: () => d(api.get("/account/addresses")),
  addAddress: (a) => d(api.post("/account/addresses", a)),
  updateAddress: (id, a) => d(api.patch(`/account/addresses/${id}`, a)),
  removeAddress: (id) => d(api.delete(`/account/addresses/${id}`)),
};
