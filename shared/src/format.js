// All amounts from the API are integers in paisa (1/100 NPR).
export function money(paisa, { free = false } = {}) {
  if (paisa === null || paisa === undefined) return "—";
  if (free && paisa === 0) return "Free";
  const rupees = paisa / 100;
  return `Rs ${rupees.toLocaleString("en-IN", { minimumFractionDigits: rupees % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

export const toRupees = (paisa) => (paisa === null || paisa === undefined || paisa === "" ? "" : String(paisa / 100));
export const toPaisa = (rupees) => (rupees === "" || rupees === null || rupees === undefined ? null : Math.round(Number(rupees) * 100));

export const dateTime = (d) => (d ? new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
export const date = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");

export function timeAgo(d) {
  const s = Math.round((Date.now() - new Date(d)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export const pct = (n) => `${(n * 100).toFixed(n < 0.1 && n > 0 ? 1 : 0)}%`;

export const discountPct = (price, compare) => (compare && compare > price ? Math.round(((compare - price) / compare) * 100) : 0);

export const STATUS_LABEL = {
  pending_payment: "Awaiting payment", paid: "Paid", confirmed: "Confirmed", processing: "Processing", shipped: "Shipped",
  delivered: "Delivered", cancelled: "Cancelled", refunded: "Refunded", returned: "Returned",
  draft: "Draft", active: "Active", archived: "Archived", scheduled: "Scheduled",
  unpaid: "Unpaid", refund_pending: "Refund pending", partially_refunded: "Partially refunded",
};

export const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`);

/** Ask the image CDN for a smaller rendition (Unsplash). Other URLs are returned unchanged. */
export function sized(url, width) {
  if (!url || !/^https:\/\/images\.unsplash\.com\//.test(url)) return url;
  const u = new URL(url);
  u.searchParams.set("w", String(width));
  return u.toString();
}

/** srcSet for responsive <img>; undefined when the URL can't be resized. */
export const srcSetFor = (url, widths = [320, 640, 960, 1200]) =>
  url && /^https:\/\/images\.unsplash\.com\//.test(url) ? widths.map((w) => `${sized(url, w)} ${w}w`).join(", ") : undefined;
