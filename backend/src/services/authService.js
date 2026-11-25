import ResetPassword from "../models/ResetPassword.js";
import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import config from "../config.js";
import { generateSecret, verifyTotp, otpauthUrl } from "../lib/totp.js";
import { badRequest, unauthorized, notFound } from "../lib/errors.js";
import { randomToken } from "../lib/util.js";
import { notify } from "./notificationService.js";

export const publicUser = (u) => ({
  id: String(u._id),
  name: u.name,
  email: u.email,
  roles: u.roles,
  addresses: u.addresses || [],
  twoFactorEnabled: !!u.twoFactor?.enabled,
  createdAt: u.createdAt || u.createdAT,
});

const registerUser = async (input) => {
  const email = String(input.email || "").toLowerCase().trim();
  if (await User.findOne({ email })) throw badRequest("USER_EXISTS", "An account with this email already exists.");
  if (String(input.password || "").length < 6) throw badRequest("WEAK_PASSWORD", "Password must be at least 6 characters.");
  // Roles are never taken from the request body.
  const created = await User.create({ name: input.name, email, password: bcrypt.hashSync(input.password), roles: ["USER"] });
  return publicUser(created);
};

const loginUser = async (input) => {
  const email = String(input.email || "").toLowerCase().trim();
  const user = await User.findOne({ email }).select("+password +twoFactor.secret");
  // Same message for unknown email and wrong password (no account enumeration).
  if (!user || !bcrypt.compareSync(String(input.password || ""), user.password))
    throw unauthorized("Incorrect email or password");
  if (user.twoFactor?.enabled) {
    const challenge = jwt.sign({ id: String(user._id), purpose: "2fa" }, config.jwtSecret, { expiresIn: 300 });
    return { twoFactorRequired: true, challenge };
  }
  return { user: publicUser(user), mfa: false };
};

const verifyTwoFactorLogin = async (challenge, code) => {
  let data;
  try {
    data = jwt.verify(challenge, config.jwtSecret);
  } catch {
    throw unauthorized("Login session expired, please sign in again.");
  }
  if (data.purpose !== "2fa") throw unauthorized();
  const user = await User.findById(data.id).select("+twoFactor.secret");
  if (!user || !verifyTotp(user.twoFactor.secret, code)) throw badRequest("INVALID_CODE", "Invalid authentication code.");
  return { user: publicUser(user), mfa: true };
};

const startTwoFactorSetup = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw notFound();
  const secret = generateSecret();
  await User.updateOne({ _id: userId }, { "twoFactor.pendingSecret": secret });
  return { secret, otpauthUrl: otpauthUrl(secret, user.email) };
};

const confirmTwoFactorSetup = async (userId, code) => {
  const user = await User.findById(userId).select("+twoFactor.pendingSecret");
  if (!user?.twoFactor?.pendingSecret) throw badRequest("NO_PENDING_SETUP", "Start 2FA setup first.");
  if (!verifyTotp(user.twoFactor.pendingSecret, code)) throw badRequest("INVALID_CODE", "Invalid authentication code.");
  await User.updateOne(
    { _id: userId },
    { "twoFactor.enabled": true, "twoFactor.secret": user.twoFactor.pendingSecret, $unset: { "twoFactor.pendingSecret": 1 } }
  );
  return publicUser(await User.findById(userId));
};

const forgotPassword = async (email) => {
  const user = await User.findOne({ email: String(email).toLowerCase().trim() });
  if (user) {
    const token = randomToken(16);
    await ResetPassword.create({ userId: user._id, token, expiresAt: new Date(Date.now() + 15 * 60_000) });
    await notify({
      channel: "email", to: user.email, template: "reset_password", subject: "Reset your password",
      body: `${config.appUrl}/auth/reset-password/${user._id}?token=${token}`,
    });
  }
  return { message: "If that email is registered, a reset link has been sent." };
};

const resetPassword = async (userId, password, token) => {
  const data = await ResetPassword.findOne({ userId, token, isUsed: false, expiresAt: { $gt: new Date() } });
  if (!data) throw badRequest("INVALID_TOKEN", "Invalid or expired token.");
  if (String(password).length < 6) throw badRequest("WEAK_PASSWORD", "Password must be at least 6 characters.");
  await User.findByIdAndUpdate(userId, { password: bcrypt.hashSync(password) });
  await ResetPassword.findByIdAndUpdate(data._id, { isUsed: true });
  return { message: "Password reset successful." };
};

export default { registerUser, loginUser, verifyTwoFactorLogin, startTwoFactorSetup, confirmTwoFactorSetup, forgotPassword, resetPassword };
