import Notification from "../models/Notification.js";

const fmt = (p) => `Rs ${(p / 100).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
export { fmt as formatMoney };

// Queue a notification. dedupeKey makes repeated triggers (webhook retries, job re-runs) no-ops.
export async function notify({ channel, to, template, subject, body, dedupeKey, severity = "info", meta }) {
  try {
    const n = await Notification.create({ channel, to, template, subject, body, dedupeKey, severity, meta, status: channel === "admin" ? "sent" : "queued" });
    if (channel !== "admin") {
      // Dev "delivery": log it. Replace with an SMTP/SMS provider worker in production.
      console.log(`[${channel}] to=${to} subject="${subject}"`);
      await Notification.updateOne({ _id: n._id }, { status: "sent" });
    }
    return n;
  } catch (e) {
    if (e?.code === 11000) return null; // already queued
    throw e;
  }
}

export const adminAlert = (subject, body, { severity = "warning", dedupeKey, meta } = {}) =>
  notify({ channel: "admin", template: "admin_alert", subject, body, severity, dedupeKey, meta });
