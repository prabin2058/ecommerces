import express from "express";
import { ah } from "../lib/errors.js";
import { optionalAuth } from "../middlewares/auth.js";
import * as catalog from "../services/catalogService.js";
import { track } from "../services/cartService.js";

const router = express.Router();
router.use(optionalAuth);

router.get("/", ah(async (req, res) => {
  res.setHeader("Cache-Control", "public, max-age=30");
  res.json(await catalog.listProducts(req.query));
}));
router.get("/categories", ah(async (req, res) => {
  res.setHeader("Cache-Control", "public, max-age=60");
  res.json(await catalog.listCategories());
}));
router.get("/suggest", ah(async (req, res) => res.json(await catalog.searchSuggest(String(req.query.q || "")))));
router.get("/:slug", ah(async (req, res) => {
  const p = await catalog.getProductBySlug(req.params.slug);
  track(req, "product_view", { product: p.id });
  res.setHeader("Cache-Control", "public, max-age=30");
  res.json(p);
}));

export default router;
