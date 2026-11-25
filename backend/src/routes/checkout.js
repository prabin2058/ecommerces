import express from "express";
import { ah } from "../lib/errors.js";
import { optionalAuth } from "../middlewares/auth.js";
import rateLimit from "../lib/rateLimit.js";
import * as checkout from "../services/checkoutService.js";
import { track } from "../services/cartService.js";

const router = express.Router();
router.use(optionalAuth);
router.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

router.post("/start", ah(async (req, res) => {
  track(req, "checkout_start");
  res.json({ ok: true });
}));
router.post("/shipping-rates", rateLimit({ key: "rates", max: 60 }), ah(async (req, res) => res.json(await checkout.shippingRates(req, req.body?.address))));
router.post("/validate", rateLimit({ key: "validate", max: 60 }), ah(async (req, res) => {
  const { quote, changes, ok } = await checkout.validateCheckout(req, req.body || {});
  const { lines, ...rest } = quote;
  res.json({ ok, changes, quote: { ...rest, items: lines } });
}));
router.post("/place-order", rateLimit({ key: "place-order", max: 10 }), ah(async (req, res) => {
  const result = await checkout.placeOrder(req, res, req.get("Idempotency-Key"), req.body);
  res.status(result.replay ? 200 : 201).json(result);
}));

export default router;
