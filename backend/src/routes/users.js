import express from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { ah } from "../lib/errors.js";
import { listUsers } from "../services/adminService.js";

// Legacy route kept for compatibility; admin-only.
const router = express.Router();
router.get("/", requireAuth, requireRole("ADMIN"), ah(async (req, res) => res.json(await listUsers(req.query))));
export default router;
