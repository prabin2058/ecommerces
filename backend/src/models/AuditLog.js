import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema({
  entity: { type: String, required: true },
  entityId: { type: String, index: true },
  action: { type: String, required: true },
  changes: [{ _id: false, field: String, old: mongoose.Schema.Types.Mixed, new: mongoose.Schema.Types.Mixed }],
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  userName: String,
  createdAt: { type: Date, default: Date.now, index: true },
});

export default mongoose.model("AuditLog", auditLogSchema);
