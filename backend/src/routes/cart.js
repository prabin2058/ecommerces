import express from "express";
import { ah } from "../lib/errors.js";
import { optionalAuth, requireAuth } from "../middlewares/auth.js";
import rateLimit from "../lib/rateLimit.js";
import * as cart from "../services/cartService.js";

const router = express.Router();
router.use(optionalAuth);
router.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

router.get("/", ah(async (req, res) => res.json(await cart.cartView(await cart.findCart(req)))));
router.post("/items", rateLimit({ key: "cart-add", max: 40 }), ah(async (req, res) => res.json(await cart.addItem(req, res, req.body || {}))));
router.patch("/items/:itemId", rateLimit({ key: "cart-update", max: 80 }), ah(async (req, res) => res.json(await cart.updateItem(req, res, req.params.itemId, req.body || {}))));
router.delete("/items/:itemId", ah(async (req, res) => res.json(await cart.removeItem(req, res, req.params.itemId))));
router.post("/items/:itemId/accept-price", ah(async (req, res) => res.json(await cart.acceptPrice(req, res, req.params.itemId))));
router.post("/items/:itemId/save-for-later", ah(async (req, res) => res.json(await cart.saveForLater(req, res, req.params.itemId))));
router.post("/saved/:variantId/move-to-cart", ah(async (req, res) => res.json(await cart.moveToCart(req, res, req.params.variantId))));
router.delete("/saved/:variantId", ah(async (req, res) => res.json(await cart.removeSaved(req, res, req.params.variantId))));
router.post("/coupon", rateLimit({ key: "coupon", max: 10 }), ah(async (req, res) => res.json(await cart.applyCoupon(req, res, req.body?.code))));
router.delete("/coupon", ah(async (req, res) => res.json(await cart.removeCoupon(req, res))));
router.post("/merge", requireAuth, ah(async (req, res) => {
  const result = await cart.mergeGuestCartIntoUser(req, res, req.user.id);
  res.json({ ...(await cart.cartView(await cart.findCart(req))), merge: result });
}));

export default router;
