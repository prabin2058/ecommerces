import mongoose from "mongoose";

// Append-only audit of every stock change.
const inventoryLogSchema = new mongoose.Schema({
  variant: { type: mongoose.Schema.Types.ObjectId, ref: "Variant", required: true, index: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  sku: String,
  field: { type: String, enum: ["onHand", "reserved"], default: "onHand" },
  change: { type: Number, required: true },
  after: Number,
  reason: {
    type: String,
    enum: ["initial", "restock", "sale", "return", "manual_adjust", "damaged", "reserve", "release", "import", "cancel", "refund"],
    required: true,
  },
  note: String,
  refType: String,
  refId: String,
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now, index: true },
});

export default mongoose.model("InventoryLog", inventoryLogSchema);
