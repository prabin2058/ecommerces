import mongoose from "mongoose";
import { EMAIL_REGEX } from "../constants/regex.js";

const addressSchema = new mongoose.Schema(
  {
    label: String,
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    line1: { type: String, required: true },
    line2: String,
    city: { type: String, required: true },
    province: String,
    postalCode: String,
    country: { type: String, default: "Nepal" },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    address: String,
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      validate: { validator: (e) => EMAIL_REGEX.test(e), message: "invalid email address" },
    },
    password: { type: String, required: true, minlength: 6, select: false },
    // USER, CATALOG_MANAGER (edit catalog), ADMIN (everything)
    roles: { type: [String], default: ["USER"] },
    addresses: [addressSchema],
    twoFactor: {
      enabled: { type: Boolean, default: false },
      secret: { type: String, select: false },
      pendingSecret: { type: String, select: false },
    },
    createdAT: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
