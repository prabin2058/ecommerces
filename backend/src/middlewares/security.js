// Basic security headers + CSRF guard for cookie-authenticated JSON APIs.
export function securityHeaders(_req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  next();
}

// Browsers cannot send custom headers cross-site without CORS preflight (which we never allow),
// so requiring X-Requested-With on writes blocks CSRF even though auth/cart use cookies.
const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);
export function csrfGuard(req, res, next) {
  if (SAFE.has(req.method)) return next();
  if (req.path.startsWith("/payments/webhook")) return next(); // server-to-server, signature-verified
  if (req.get("X-Requested-With") !== "XMLHttpRequest")
    return res.status(403).json({ error: "CSRF_REJECTED", message: "Missing X-Requested-With header." });
  next();
}
