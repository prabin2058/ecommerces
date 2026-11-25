import jwt from "jsonwebtoken";
import config from "../config.js";
import { parseCookies } from "../lib/util.js";

function readToken(req) {
  const header = req.headers?.authorization || "";
  if (header.startsWith("Bearer ")) {
    const t = header.slice(7).trim();
    if (t && t !== "null" && t !== "undefined") return t;
  }
  return parseCookies(req.headers.cookie).authToken || null;
}

function decode(req) {
  const token = readToken(req);
  if (!token) return null;
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch {
    return null;
  }
}

// Sets req.user when a valid token is present; never rejects (guest-friendly routes).
export function optionalAuth(req, _res, next) {
  req.user = decode(req);
  next();
}

export function requireAuth(req, res, next) {
  const user = decode(req);
  if (!user) return res.status(401).json({ error: "UNAUTHORIZED", message: "Please log in." });
  req.user = user;
  next();
}

export const hasRole = (user, ...roles) => !!user && (user.roles || []).some((r) => r === "ADMIN" || roles.includes(r));

// requireRole("CATALOG_MANAGER") lets CATALOG_MANAGER and ADMIN through.
export const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!hasRole(req.user, ...roles)) return res.status(403).json({ error: "FORBIDDEN", message: "You do not have permission to do this." });
    next();
  };

// Admin area: staff role + (when enforced) a token that passed 2FA.
export function requireStaff(req, res, next) {
  requireAuth(req, res, () => {
    if (!hasRole(req.user, "CATALOG_MANAGER")) return res.status(403).json({ error: "FORBIDDEN", message: "Staff only." });
    if (config.requireAdmin2fa && !req.user.mfa)
      return res.status(403).json({ error: "MFA_REQUIRED", message: "Two-factor authentication is required for the admin area." });
    next();
  });
}

export default requireAuth;
