import crypto from "crypto";

export const randomToken = (bytes = 24) => crypto.randomBytes(bytes).toString("base64url");

export function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function uniqueSlug(Model, base, excludeId) {
  const root = slugify(base) || "item";
  let slug = root;
  for (let i = 2; ; i++) {
    const q = { slug };
    if (excludeId) q._id = { $ne: excludeId };
    if (!(await Model.exists(q))) return slug;
    slug = `${root}-${i}`;
  }
}

export const toInt = (v, def) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
};

// Rupees (decimal, as typed by admins) -> paisa integer.
export function rupeesToPaisa(v) {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 100);
}

export const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function hmac(secret, payload) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

export function parseCookies(header = "") {
  const out = {};
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (!k) continue;
    try {
      out[k] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      out[k] = part.slice(i + 1).trim();
    }
  }
  return out;
}

export function orderNumber() {
  const d = new Date();
  const ymd = `${d.getFullYear() % 100}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `ORD-${ymd}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

// Storefront origin for redirects (gateway return URL). In production always APP_URL;
// in dev accept the proxying dev server's localhost origin so any Vite port works.
export function requestAppUrl(req, fallback) {
  if (process.env.NODE_ENV === "production") return fallback;
  const host = req.get("x-forwarded-host") || "";
  return /^localhost:\d{2,5}$/.test(host) ? `http://${host}` : fallback;
}
