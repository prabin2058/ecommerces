import express from "express";
import * as c from "../controllers/authController.js";
import { requireAuth } from "../middlewares/auth.js";
import rateLimit from "../lib/rateLimit.js";

const router = express.Router();
const authLimit = rateLimit({ key: "auth", windowMs: 15 * 60_000, max: 30 });

router.post("/register", authLimit, c.registerUser);
router.post("/login", authLimit, c.loginUser);
router.post("/2fa/verify", authLimit, c.verifyTwoFactor);
router.post("/2fa/setup", requireAuth, c.setupTwoFactor);
router.post("/2fa/confirm", requireAuth, authLimit, c.confirmTwoFactor);
router.get("/me", requireAuth, c.me);
router.post("/forgot-password", authLimit, c.forgotPassword);
router.post("/reset-password/:userId", authLimit, c.resetPassword);
router.post("/logout", c.logoutUser);

export default router;
