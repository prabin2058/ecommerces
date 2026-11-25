import { EMAIL_REGEX } from "../constants/regex.js";
import { createToken, authCookieOptions } from "../helpers/authHelpers.js";
import authService, { publicUser } from "../services/authService.js";
import User from "../models/User.js";
import { mergeGuestCartIntoUser } from "../services/cartService.js";
import { ah, validation, notFound } from "../lib/errors.js";

async function issueSession(req, res, user, mfa) {
  const token = createToken(user, { mfa });
  res.cookie("authToken", token, authCookieOptions);
  // Merge the guest cart (cookie) into the user's cart on login.
  await mergeGuestCartIntoUser(req, res, user.id);
  res.json({ ...user, token, mfa });
}

export const registerUser = ah(async (req, res) => {
  const { name, email, password, confirmPassword } = req.body || {};
  const errors = {};
  if (!name || name.trim().length < 2) errors.name = "Name is required";
  if (!email || !EMAIL_REGEX.test(email)) errors.email = "Enter a valid email";
  if (!password || password.length < 6) errors.password = "At least 6 characters";
  if (confirmPassword !== undefined && confirmPassword !== password) errors.confirmPassword = "Passwords do not match";
  if (Object.keys(errors).length) throw validation(errors);
  const user = await authService.registerUser({ name: name.trim(), email, password });
  await issueSession(req, res, user, false);
});

export const loginUser = ah(async (req, res) => {
  const result = await authService.loginUser(req.body || {});
  if (result.twoFactorRequired) return res.json(result);
  await issueSession(req, res, result.user, false);
});

export const verifyTwoFactor = ah(async (req, res) => {
  const { user } = await authService.verifyTwoFactorLogin(req.body?.challenge, req.body?.code);
  await issueSession(req, res, user, true);
});

export const me = ah(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw notFound("User not found");
  res.json({ ...publicUser(user), mfa: !!req.user.mfa });
});

export const setupTwoFactor = ah(async (req, res) => res.json(await authService.startTwoFactorSetup(req.user.id)));

export const confirmTwoFactor = ah(async (req, res) => {
  const user = await authService.confirmTwoFactorSetup(req.user.id, req.body?.code);
  // Upgrade the current session to an MFA session.
  const token = createToken(user, { mfa: true });
  res.cookie("authToken", token, authCookieOptions);
  res.json({ ...user, token, mfa: true });
});

export const forgotPassword = ah(async (req, res) => {
  if (!req.body?.email) throw validation({ email: "Email is required" });
  res.json(await authService.forgotPassword(req.body.email));
});

export const resetPassword = ah(async (req, res) => {
  const { password, confirmPassword } = req.body || {};
  if (!password) throw validation({ password: "Password is required" });
  if (password !== confirmPassword) throw validation({ confirmPassword: "Passwords do not match" });
  res.json(await authService.resetPassword(req.params.userId, password, req.query.token));
});

export const logoutUser = (req, res) => {
  res.clearCookie("authToken", { path: "/" });
  res.json({ message: "Logged out successfully" });
};
