import mongoose from "mongoose";

// One row per sellable combination. Stock lives here (single "main" warehouse).
// available = onHand - reserved; reserved <= onHand is enforced by conditional updates.
const variantSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    sku: { type: String, required: true, unique: true, trim: true, uppercase: true },
    options: { type: Map, of: String, default: {} }, // { Size: "M", Color: "Blue" }
    price: { type: Number, required: true, min: 1 },
    compareAtPrice: { type: Number, min: 0 },
    costPrice: { type: Number, min: 0 },
    weightGrams: Number,
    image: String,
    isActive: { type: Boolean, default: true },
    isDefault: { type: Boolean, default: false },
    onHand: { type: Number, default: 0 },
    reserved: { type: Number, default: 0, min: 0 },
    lowStockThreshold: { type: Number, default: 5, min: 0 },
    position: { type: Number, default: 0 },
  },
  { timestamps: true }
);

variantSchema.virtual("available").get(function () {
  return this.onHand - this.reserved;
});
variantSchema.set("toJSON", { virtuals: true, flattenMaps: true });
variantSchema.set("toObject", { virtuals: true, flattenMaps: true });

export const variantLabel = (v) => {
  const opts = v.options instanceof Map ? Object.fromEntries(v.options) : v.options || {};
  const vals = Object.values(opts).filter(Boolean);
  return vals.length ? vals.join(" / ") : "Default";
};

export default mongoose.model("Variant", variantSchema);
