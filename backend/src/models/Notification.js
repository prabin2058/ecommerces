import mongoose from "mongoose";

// Outbox for emails/SMS/admin alerts. A worker would deliver these; in dev they are logged
// and viewable in Admin → Activity.
const notificationSchema = new mongoose.Schema({
  channel: { type: String, enum: ["email", "sms", "admin"], required: true },
  to: String,
  template: String,
  subject: String,
  body: String,
  dedupeKey: { type: String, unique: true, sparse: true },
  status: { type: String, enum: ["queued", "sent", "failed"], default: "queued" },
  severity: { type: String, enum: ["info", "warning", "critical"], default: "info" },
  read: { type: Boolean, default: false },
  meta: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now, index: true },
});

export default mongoose.model("Notification", notificationSchema);
