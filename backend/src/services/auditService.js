import AuditLog from "../models/AuditLog.js";

const norm = (v) => {
  if (v === undefined) return null;
  if (v && typeof v === "object") return JSON.parse(JSON.stringify(v));
  return v;
};

// Record field-level diffs between `before` and `after` for the given keys.
export function diff(before = {}, after = {}, keys) {
  const fields = keys || [...new Set([...Object.keys(before), ...Object.keys(after)])];
  const changes = [];
  for (const f of fields) {
    const a = JSON.stringify(norm(before[f]));
    const b = JSON.stringify(norm(after[f]));
    if (a !== b) changes.push({ field: f, old: norm(before[f]), new: norm(after[f]) });
  }
  return changes;
}

export async function audit(user, entity, entityId, action, changes = []) {
  if (action === "update" && !changes.length) return;
  await AuditLog.create({ entity, entityId: String(entityId), action, changes, user: user?.id, userName: user?.name || user?.email || "system" });
}
