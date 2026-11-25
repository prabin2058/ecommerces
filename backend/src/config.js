import dotenv from "dotenv";
dotenv.config();

const isProd = process.env.NODE_ENV === "production";

function devDefault(name, fallback) {
  if (process.env[name]) return process.env[name];
  if (isProd) throw new Error(`${name} must be set in production`);
  return fallback;
}

const config = {
  isProd,
  port: Number(process.env.PORT || 5050),
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  // Public base URL of the storefront (used in emails / gateway redirects).
  appUrl: process.env.APP_URL || "http://localhost:5173",
  // Base URL this API can reach itself on (mock gateway webhook delivery).
  selfUrl: process.env.SELF_URL || `http://localhost:${process.env.PORT || 5050}`,
  currency: "NPR",
  webhookSecret: devDefault("PAYMENT_WEBHOOK_SECRET", "dev-webhook-secret-change-me"),
  uploadSecret: devDefault("UPLOAD_SIGNING_SECRET", "dev-upload-secret-change-me"),
  requireAdmin2fa: process.env.ADMIN_2FA_REQUIRED
    ? process.env.ADMIN_2FA_REQUIRED === "true"
    : isProd,
  cart: {
    guestTtlDays: 30,
    maxQtyPerLine: 10,
    maxItemsPerOrder: 50,
  },
  checkout: {
    reservationMinutes: 15,
    freeShippingThreshold: 500000, // Rs 5,000 in paisa
  },
  tax: { standard: 0.13, reduced: 0.05, exempt: 0 },
  upload: { maxBytes: 5 * 1024 * 1024 },
};

export default config;
