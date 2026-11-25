import express from "express";
import path from "path";
import url from "url";
import config from "./config.js";
import connectDB from "./database.js";
import logger from "./middlewares/logger.js";
import { securityHeaders, csrfGuard } from "./middlewares/security.js";
import { errorHandler } from "./lib/errors.js";
import authRoute from "./routes/auth.js";
import userRoute from "./routes/users.js";
import catalogRoute from "./routes/catalog.js";
import cartRoute from "./routes/cart.js";
import checkoutRoute from "./routes/checkout.js";
import paymentsRoute from "./routes/payments.js";
import ordersRoute from "./routes/orders.js";
import accountRoute from "./routes/account.js";
import adminRoute from "./routes/admin.js";
import { gatewayRouter } from "./gateway/mockGateway.js";
import { startJobs } from "./jobs/scheduler.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const app = express();
app.set("trust proxy", "loopback");
app.disable("x-powered-by");

app.use(securityHeaders);
app.use(logger);
app.use(
  "/images",
  express.static(path.join(__dirname, "../public/assets/images"), {
    maxAge: "30d",
    immutable: true,
    setHeaders: (res) => res.setHeader("Content-Security-Policy", "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'"),
  })
);

// Sandbox payment provider (would be a separate domain in reality).
app.use("/mock-gateway", gatewayRouter);

// Webhooks need the raw body — mount before the JSON parser.
app.use("/api/payments", paymentsRoute);

app.use(express.json({ limit: "1mb" }));
app.use("/api", csrfGuard);

app.get("/api/health", (req, res) => res.json({ ok: true, time: new Date().toISOString() }));
app.use("/api/auth", authRoute);
app.use("/api/users", userRoute);
app.use("/api/products", catalogRoute);
app.use("/api/cart", cartRoute);
app.use("/api/checkout", checkoutRoute);
app.use("/api/orders", ordersRoute);
app.use("/api/account", accountRoute);
app.use("/api/admin", adminRoute);

app.use("/api", (req, res) => res.status(404).json({ error: "NOT_FOUND", message: "Endpoint not found" }));
app.use(errorHandler);

await connectDB();
app.listen(config.port, () => {
  console.log(`server is running at port ${config.port}`);
  startJobs();
});
