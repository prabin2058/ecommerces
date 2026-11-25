import express from "express";
import { ah } from "../lib/errors.js";
import { handleWebhook } from "../services/paymentService.js";

const router = express.Router();

// Raw body is required to verify the signature byte-for-byte.
router.post("/webhook/:gateway", express.raw({ type: "*/*", limit: "1mb" }), ah(async (req, res) => {
  const raw = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";
  const result = await handleWebhook(req.params.gateway, raw, req.get("X-Mock-Signature"));
  res.json({ received: true, ...result });
}));

export default router;
