import mongoose from "mongoose";

// Claimed before any side effect so concurrent requests with the same key are serialized.
const idempotencyKeySchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  scope: { type: String, default: "place-order" },
  createdAt: { type: Date, default: Date.now, expires: 86400 },
});

export default mongoose.model("IdempotencyKey", idempotencyKeySchema);
