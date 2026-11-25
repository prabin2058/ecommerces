import jwt from "jsonwebtoken";
import config from "../config.js";

export function createToken(data, { mfa = false } = {}) {
  const payload = { id: String(data.id), name: data.name, email: data.email, roles: data.roles, mfa };
  return jwt.sign(payload, config.jwtSecret, { expiresIn: 86400 });
}

export const authCookieOptions = {
  httpOnly: true,
  secure: config.isProd,
  sameSite: "lax",
  maxAge: 86400 * 1000,
  path: "/",
};
