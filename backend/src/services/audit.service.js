const AuditLog = require("../models/AuditLog.model");

async function recordAudit({
  actorId = null,
  actorEmail = "system",
  action,
  resourceType,
  resourceId = null,
  before = null,
  after = null,
  metadata = null,
}) {
  return AuditLog.create({
    actor: actorId,
    actorEmail,
    action,
    resourceType,
    resourceId: resourceId ? String(resourceId) : null,
    before,
    after,
    metadata,
  });
}

module.exports = {
  recordAudit,
};
