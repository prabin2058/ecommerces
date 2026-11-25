export default function logger(req, res, next) {
  const start = Date.now();
  res.on("finish", () => {
    if (req.originalUrl.startsWith("/images")) return;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
}
