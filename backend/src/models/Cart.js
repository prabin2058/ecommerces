import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema({
  variant: { type: mongoose.Schema.Types.ObjectId, ref: "Variant", required: true },
  quantity: { type: Number, required: true, min: 1 },
  unitPriceAtAdd: { type: Number, required: true },
  addedAt: { type: Date, default: Date.now },
});

const cartSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    sessionToken: { type: String, index: true },
    items: [cartItemSchema],
    savedItems: [{ _id: false, variant: { type: mongoose.Schema.Types.ObjectId, ref: "Variant" }, savedAt: Date }],
    couponCode: { type: String, default: null },
    email: String, // captured at checkout, used for abandoned-cart reminders
    status: { type: String, enum: ["active", "converted", "merged"], default: "active", index: true },
    remindersSent: { type: Number, default: 0 },
    lastActivityAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, index: { expireAfterSeconds: 0 } },
  },
  { timestamps: true }
);

// One active cart per logged-in user.
cartSchema.index({ user: 1 }, { unique: true, partialFilterExpression: { status: "active", user: { $type: "objectId" } } });

export default mongoose.model("Cart", cartSchema);
