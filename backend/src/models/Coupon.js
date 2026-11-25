import mongoose from "mongoose";

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: String,
    type: { type: String, enum: ["percent", "fixed", "free_shipping"], required: true },
    value: { type: Number, default: 0, min: 0 }, // percent (0-100) or paisa
    maxDiscount: { type: Number, min: 0 }, // cap for percent coupons (paisa)
    minSpend: { type: Number, default: 0, min: 0 },
    usageLimit: { type: Number, default: null },
    usedCount: { type: Number, default: 0 },
    startsAt: Date,
    expiresAt: Date,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Coupon", couponSchema);
