import mongoose from "mongoose";

// One order can have several attempts (declined -> retry with another method).
const paymentSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    gateway: { type: String, required: true },
    gatewayRef: { type: String, index: true },
    idempotencyKey: { type: String, unique: true, sparse: true },
    method: String,
    amount: { type: Number, required: true },
    currency: { type: String, default: "NPR" },
    status: { type: String, enum: ["created", "pending", "succeeded", "failed", "refunded", "cancelled"], default: "created" },
    failureReason: String,
    redirectUrl: String,
    refundedAmount: { type: Number, default: 0 },
    raw: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

export default mongoose.model("Payment", paymentSchema);
