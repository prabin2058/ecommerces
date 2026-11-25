export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message || code);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (code, message, details) => new AppError(400, code, message, details);
export const notFound = (message = "Not found") => new AppError(404, "NOT_FOUND", message);
export const conflict = (code, message, details) => new AppError(409, code, message, details);
export const forbidden = (message = "Forbidden") => new AppError(403, "FORBIDDEN", message);
export const unauthorized = (message = "Unauthorized") => new AppError(401, "UNAUTHORIZED", message);
export const validation = (details, message = "Validation failed") =>
  new AppError(422, "VALIDATION_ERROR", message, details);

// Wrap async route handlers so thrown errors reach the error middleware.
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) });
  }
  if (err?.name === "ValidationError") {
    const details = Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v.message]));
    return res.status(422).json({ error: "VALIDATION_ERROR", message: "Validation failed", details });
  }
  if (err?.name === "CastError") {
    return res.status(400).json({ error: "INVALID_ID", message: `Invalid ${err.path}` });
  }
  if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || "field";
    return res.status(409).json({ error: "DUPLICATE", message: `${field} already exists`, details: { field } });
  }
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ error: "PAYLOAD_TOO_LARGE", message: "Payload too large" });
  }
  console.error("[error]", req.method, req.originalUrl, err);
  res.status(500).json({ error: "INTERNAL_ERROR", message: "Something went wrong" });
}
