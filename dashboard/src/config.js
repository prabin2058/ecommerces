// The storefront is a separate app (../frontend).
export const STORE_URL = (import.meta.env.VITE_STORE_URL || "http://localhost:5173").replace(/\/$/, "");
