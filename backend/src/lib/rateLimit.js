// Fixed-window in-memory rate limiter (per IP + route key). Use Redis in a multi-instance deploy.
const buckets = new Map();

export default function rateLimit({ key, windowMs = 60_000, max = 30 }) {
  return (req, res, next) => {
    const id = `${key}:${req.ip}`;
    const now = Date.now();
    let b = buckets.get(id);
    if (!b || b.reset < now) {
      b = { count: 0, reset: now + windowMs };
      buckets.set(id, b);
    }
    b.count += 1;
    res.setHeader("RateLimit-Remaining", Math.max(0, max - b.count));
    if (b.count > max) {
      res.setHeader("Retry-After", Math.ceil((b.reset - now) / 1000));
      return res.status(429).json({ error: "RATE_LIMITED", message: "Too many requests, slow down." });
    }
    next();
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k);
}, 60_000).unref();
