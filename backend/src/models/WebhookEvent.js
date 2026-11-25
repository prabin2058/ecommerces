import mongoose from "mongoose";

// Processed gateway events — unique eventId makes webhook handling idempotent.
const webhookEventSchema = new mongoose.Schema({
  gateway: String,
  eventId: { type: String, required: true, unique: true },
  type: String,
  payload: mongoose.Schema.Types.Mixed,
  receivedAt: { type: Date, default: Date.now },
  result: String,
});

export default mongoose.model("WebhookEvent", webhookEventSchema);
