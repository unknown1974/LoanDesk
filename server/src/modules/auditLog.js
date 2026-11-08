import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: String, required: true },
    action: { type: String, required: true },
    entity: { type: String, required: true },
    entityId: { type: mongoose.Schema.Types.ObjectId },
    meta: { type: mongoose.Schema.Types.Mixed },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { versionKey: false }
);

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);

export async function audit(req, action, entity, entityId, meta) {
  try {
    await AuditLog.create({ actor: req.user?.email || 'system', action, entity, entityId, meta });
  } catch (e) {
    console.error('Audit log failed', e.message);
  }
}
