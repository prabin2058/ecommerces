import axios from "axios";
// With the Vite dev proxy (VITE_PROXY_TARGET) the API is same-origin, so cookies work and the
// dev server port doesn't matter. Otherwise use VITE_API_URL (e.g. a separate API domain).
const env = import.meta.env;
const apiUrl = env.DEV && env.VITE_PROXY_TARGET ? "" : env.VITE_API_URL || "";

const api = axios.create({
  baseURL: `${apiUrl}/api`,
  withCredentials: true, // cart + auth cookies (HTTP-only)
  headers: { "X-Requested-With": "XMLHttpRequest" }, // CSRF guard on the API
});

api.interceptors.request.use((req) => {
  const token = localStorage.getItem("authToken");
  if (token) req.headers.Authorization = `Bearer ${token}`;
  return req;
});

let onUnauthorized = null;
export const setUnauthorizedHandler = (fn) => (onUnauthorized = fn);

api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401 && onUnauthorized && !error.config?.url?.startsWith("/auth/")) onUnauthorized();
    return Promise.reject(error);
  }
);

/** Normalized error message from an API error. */
export function errorMessage(err, fallback = "Something went wrong. Please try again.") {
  const d = err?.response?.data;
  if (!err?.response) return "Can't reach the server. Check your connection.";
  if (typeof d === "string") return d;
  if (d?.details?.publish) return d.details.publish.join(" · ");
  return d?.message || fallback;
}
export const errorCode = (err) => err?.response?.data?.error;
export const errorDetails = (err) => err?.response?.data?.details || {};

export default api;
