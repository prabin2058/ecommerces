import { requireRole } from "./auth.js";
export default (role) => requireRole(role);
