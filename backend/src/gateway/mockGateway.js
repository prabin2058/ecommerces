/**
 * Sandbox payment gateway, standing in for Stripe/Khalti/eSewa during development.
 * It has its own storage (gateway_sessions), its own hosted payment page (card data never
 * reaches the store API), and delivers HMAC-signed webhooks to /api/payments/webhook/mock.
 *
 * Test cards:  4242 4242 4242 4242 → success
 *              4000 0000 0000 0002 → declined
 *              4000 0000 0000 9995 → insufficient funds
 */
import express from "express";
import mongoose from "mongoose";
import config from "../config.js";
import { hmac, randomToken } from "../lib/util.js";

const sessionSchema = new mongoose.Schema(
  {
    _id: String,
    idempotencyKey: { type: String, unique: true },
    reference: String,
    amount: Number,
    currency: String,
    method: String,
    description: String,
    returnUrl: String,
    status: { type: String, enum: ["open", "succeeded", "failed", "cancelled"], default: "open" },
    failureReason: String,
    refunded: { type: Number, default: 0 },
    paidAt: Date,
  },
  { timestamps: true, collection: "gateway_sessions" }
);
const Session = mongoose.models.GatewaySession || mongoose.model("GatewaySession", sessionSchema);

// ---- Provider "API" (what an SDK call would do) ----
export const mockGateway = {
  name: "mock",
  async createSession({ amount, currency, reference, idempotencyKey, returnUrl, method, description }) {
    const existing = await Session.findOne({ idempotencyKey });
    if (existing) return publicSession(existing); // idempotent: same key -> same session, never a second charge
    try {
      const s = await Session.create({ _id: `ps_${randomToken(12)}`, idempotencyKey, reference, amount, currency, method, returnUrl, description });
      return publicSession(s);
    } catch (e) {
      if (e.code === 11000) return publicSession(await Session.findOne({ idempotencyKey }));
      throw e;
    }
  },
  async retrieve(id) {
    const s = await Session.findById(id);
    return s ? publicSession(s) : null;
  },
  async refund(id, amount) {
    const s = await Session.findById(id);
    if (!s || s.status !== "succeeded") return { ok: false, reason: "not_refundable" };
    const amt = Math.min(amount ?? s.amount - s.refunded, s.amount - s.refunded);
    s.refunded += amt;
    await s.save();
    return { ok: true, amount: amt, refundId: `re_${randomToken(8)}` };
  },
  async settlements({ from, to }) {
    const list = await Session.find({ status: "succeeded", paidAt: { $gte: from, $lte: to } });
    return list.map(publicSession);
  },
};

const publicSession = (s) => ({
  id: s._id, status: s.status, amount: s.amount, currency: s.currency, reference: s.reference, method: s.method,
  failureReason: s.failureReason, refunded: s.refunded, url: `/mock-gateway/pay/${s._id}`,
});

export function signPayload(body, timestamp = Math.floor(Date.now() / 1000)) {
  return `t=${timestamp},v1=${hmac(config.webhookSecret, `${timestamp}.${body}`)}`;
}

async function deliverWebhook(session, type, { times = 1 } = {}) {
  const event = {
    id: `evt_${randomToken(10)}`, type, created: Math.floor(Date.now() / 1000),
    data: { sessionId: session._id, reference: session.reference, amount: session.amount, status: session.status, failureReason: session.failureReason },
  };
  const body = JSON.stringify(event);
  for (let i = 0; i < times; i++) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await fetch(`${config.selfUrl}/api/payments/webhook/mock`, {
          method: "POST", headers: { "Content-Type": "application/json", "X-Mock-Signature": signPayload(body) }, body,
        });
        if (r.ok) break;
      } catch (e) {
        console.warn("[mock-gateway] webhook delivery failed", e.message);
      }
      await new Promise((res) => setTimeout(res, 500 * (attempt + 1)));
    }
  }
}

// ---- Hosted payment page ----
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (p) => `Rs ${(p / 100).toLocaleString("en-IN")}`;

function page(s, error) {
  const isCard = s.method === "card";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>MockPay · Secure payment</title>
<style>
:root{--bg:#f4f5f7;--card:#fff;--ink:#0f172a;--muted:#64748b;--line:#e2e8f0;--brand:#4f46e5}
*{box-sizing:border-box}body{margin:0;font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--ink);display:grid;place-items:center;min-height:100vh;padding:16px}
.box{background:var(--card);border:1px solid var(--line);border-radius:16px;max-width:420px;width:100%;padding:28px;box-shadow:0 10px 30px rgba(15,23,42,.06)}
.brand{display:flex;align-items:center;gap:8px;font-weight:700;color:var(--brand)}.lock{font-size:12px;color:var(--muted);margin-left:auto}
h1{font-size:28px;margin:18px 0 2px}.muted{color:var(--muted);font-size:13px}
label{display:block;font-size:13px;font-weight:600;margin:14px 0 6px}input{width:100%;padding:11px 12px;border:1px solid var(--line);border-radius:10px;font:inherit}
input:focus{outline:2px solid var(--brand);border-color:transparent}.row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
button{width:100%;margin-top:20px;padding:13px;border:0;border-radius:10px;background:var(--brand);color:#fff;font:600 15px inherit;cursor:pointer}
button.secondary{background:transparent;color:var(--muted);margin-top:8px}
.err{background:#fef2f2;color:#b91c1c;border-radius:10px;padding:10px 12px;margin-top:14px;font-size:14px}
.hint{background:#f8fafc;border:1px dashed var(--line);border-radius:10px;padding:10px 12px;margin-top:16px;font-size:12px;color:var(--muted)}
.opt{display:flex;gap:8px}.opt button{margin-top:12px}
</style></head><body><main class="box">
<div class="brand">◆ MockPay <span class="lock">🔒 Sandbox</span></div>
<h1>${money(s.amount)}</h1><div class="muted">${esc(s.description || "Order")} · ref ${esc(s.reference)}</div>
${error ? `<div class="err">${esc(error)}</div>` : ""}
${s.status !== "open" ? `<div class="hint">This payment session is ${esc(s.status)}.</div><form method="get" action="${esc(s.returnUrl)}"><button>Return to store</button></form>` : `
<form method="post" action="/mock-gateway/pay/${esc(s._id)}/submit" autocomplete="off">
${isCard ? `<label>Card number</label><input name="card" inputmode="numeric" placeholder="4242 4242 4242 4242" required>
<div class="row"><div><label>Expiry</label><input name="exp" placeholder="12/30" required></div><div><label>CVC</label><input name="cvc" placeholder="123" required></div></div>
<label>Name on card</label><input name="holder" placeholder="Full name">` : `<label>${s.method === "wallet" ? "Wallet ID / mobile" : "Bank account (sandbox)"}</label><input name="account" placeholder="98XXXXXXXX" required>
<label>Outcome (sandbox)</label><select name="outcome" style="width:100%;padding:11px;border:1px solid var(--line);border-radius:10px"><option value="success">Approve</option><option value="decline">Decline</option></select>`}
<button type="submit">Pay ${money(s.amount)}</button></form>
<form method="post" action="/mock-gateway/pay/${esc(s._id)}/cancel"><button class="secondary" type="submit">Cancel and return to store</button></form>
${isCard ? `<div class="hint"><b>Test cards</b><br>4242 4242 4242 4242 — approved<br>4000 0000 0000 0002 — declined<br>4000 0000 0000 9995 — insufficient funds</div>` : ""}`}
</main></body></html>`;
}

export const gatewayRouter = express.Router();
gatewayRouter.use(express.urlencoded({ extended: false }));
gatewayRouter.use((req, res, next) => {
  res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' http: https:; frame-ancestors 'none'");
  next();
});

gatewayRouter.get("/pay/:id", async (req, res) => {
  const s = await Session.findById(req.params.id);
  if (!s) return res.status(404).send("Payment session not found");
  res.send(page(s));
});

gatewayRouter.post("/pay/:id/submit", async (req, res) => {
  const s = await Session.findById(req.params.id);
  if (!s) return res.status(404).send("Payment session not found");
  if (s.status === "succeeded") return res.redirect(303, s.returnUrl);
  let outcome = "success";
  let reason;
  if (s.method === "card") {
    const card = String(req.body.card || "").replace(/\D/g, "");
    if (card.length < 12) return res.send(page(s, "Enter a valid card number."));
    if (card.endsWith("0002")) { outcome = "fail"; reason = "Your card was declined."; }
    else if (card.endsWith("9995")) { outcome = "fail"; reason = "Insufficient funds."; }
  } else if (req.body.outcome === "decline") { outcome = "fail"; reason = "Payment was declined by the provider."; }

  if (outcome === "success") {
    s.status = "succeeded";
    s.paidAt = new Date();
    s.failureReason = undefined;
  } else {
    s.status = "failed";
    s.failureReason = reason;
  }
  await s.save();
  // Webhook goes server-to-server; the browser redirect is only a UX hint.
  deliverWebhook(s, outcome === "success" ? "payment.succeeded" : "payment.failed");
  const sep = s.returnUrl.includes("?") ? "&" : "?";
  res.redirect(303, `${s.returnUrl}${sep}session=${s._id}`);
});

gatewayRouter.post("/pay/:id/cancel", async (req, res) => {
  const s = await Session.findById(req.params.id);
  if (!s) return res.status(404).send("Payment session not found");
  if (s.status === "open") {
    s.status = "cancelled";
    await s.save();
    deliverWebhook(s, "payment.cancelled");
  }
  const sep = s.returnUrl.includes("?") ? "&" : "?";
  res.redirect(303, `${s.returnUrl}${sep}cancelled=1`);
});

export default mockGateway;
