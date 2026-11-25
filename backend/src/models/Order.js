import mongoose from "mongoose";

const addressSchema = new mongoose.Schema(
  { fullName: String, phone: String, line1: String, line2: String, city: String, province: String, postalCode: String, country: String },
  { _id: false }
);

// Snapshot of what was bought — never changes when the product is edited later.
const orderItemSchema = new mongoose.Schema({
  variant: { type: mongoose.Schema.Types.ObjectId, ref: "Variant" },
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  productName: String,
  productSlug: String,
  variantLabel: String,
  sku: String,
  image: String,
  unitPrice: Number,
  quantity: Number,
  lineTotal: Number,
  taxClass: String,
  reservedQty: { type: Number, default: 0 },
  backordered: { type: Boolean, default: false },
});

export const ORDER_STATUSES = ["pending_payment", "paid", "confirmed", "processing", "shipped", "delivered", "cancelled", "refunded", "returned"];

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    accessToken: { type: String, required: true }, // guest order-tracking link
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    cart: { type: mongoose.Schema.Types.ObjectId, ref: "Cart" },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true },
    status: { type: String, enum: ORDER_STATUSES, default: "pending_payment", index: true },
    paymentStatus: { type: String, enum: ["unpaid", "paid", "refunded", "partially_refunded", "refund_pending"], default: "unpaid" },
    paymentMethod: { type: String, enum: ["card", "wallet", "bank", "cod"], required: true },
    items: [orderItemSchema],
    subtotal: Number,
    discount: { type: Number, default: 0 },
    couponCode: String,
    shippingFee: Number,
    shippingMethod: { code: String, name: String, eta: String },
    tax: Number,
    total: Number,
    currency: { type: String, default: "NPR" },
    shippingAddress: addressSchema,
    billingAddress: addressSchema,
    notes: String,
    idempotencyKey: { type: String, required: true, unique: true },
    reservationExpiresAt: Date,
    stockState: { type: String, enum: ["reserved", "committed", "released", "none"], default: "none" },
    couponCounted: { type: Boolean, default: false },
    confirmationSent: { type: Boolean, default: false },
    trackingNumber: String,
    carrier: String,
    statusHistory: [
      { _id: false, status: String, at: { type: Date, default: Date.now }, actor: String, note: String },
    ],
    flags: [String], // e.g. "paid_without_stock", "refund_failed"
  },
  { timestamps: true }
);

orderSchema.index({ createdAt: -1 });
orderSchema.index({ status: 1, reservationExpiresAt: 1 });

export default mongoose.model("Order", orderSchema);
