import mongoose from "mongoose";

// Lightweight business-metrics events (funnel: view -> add to cart -> checkout -> order).
const eventSchema = new mongoose.Schema({
  type: { type: String, enum: ["product_view", "add_to_cart", "checkout_start", "order_placed", "order_paid"], required: true },
  visitor: String,
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  value: Number,
  createdAt: { type: Date, default: Date.now, index: true },
});
eventSchema.index({ type: 1, createdAt: -1 });

export default mongoose.model("Event", eventSchema);
