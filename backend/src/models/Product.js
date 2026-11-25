import mongoose from "mongoose";

const imageSchema = new mongoose.Schema({
  url: { type: String, required: true },
  altText: { type: String, default: "" },
  position: { type: Number, default: 0 },
  variant: { type: mongoose.Schema.Types.ObjectId, ref: "Variant", default: null },
});

const optionSchema = new mongoose.Schema(
  { name: { type: String, required: true, trim: true }, values: [{ type: String, trim: true }] },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 3, maxlength: 150 },
    slug: { type: String, required: true, unique: true, index: true },
    description: { type: String, default: "" }, // sanitized HTML
    categories: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],
    brand: { type: String, trim: true },
    // Prices are integers in paisa (1/100 NPR).
    basePrice: { type: Number, required: true, min: 1 },
    compareAtPrice: { type: Number, min: 0 },
    costPrice: { type: Number, min: 0 },
    taxClass: { type: String, enum: ["standard", "reduced", "exempt"], default: "standard" },
    status: { type: String, enum: ["draft", "active", "archived"], default: "draft", index: true },
    publishAt: { type: Date, default: null }, // scheduled publish
    publishedAt: Date,
    options: [optionSchema],
    images: [imageSchema],
    weightGrams: { type: Number, min: 0, default: 0 },
    dimensionsCm: { length: Number, width: Number, height: Number },
    allowBackorder: { type: Boolean, default: false },
    seoTitle: String,
    seoDescription: String,
    featured: { type: Boolean, default: false },
    // Denormalized from variants for listing / filtering.
    priceMin: { type: Number, index: true },
    priceMax: Number,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

productSchema.index({ name: "text", brand: "text" });
productSchema.index({ status: 1, categories: 1 });

export default mongoose.model("Product", productSchema);
