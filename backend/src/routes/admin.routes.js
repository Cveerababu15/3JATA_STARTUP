const express = require("express");
const PERMISSIONS = require("../constants/permissions");
const validate = require("../middleware/validate.middleware");
const { authenticate, requireCsrf } = require("../middleware/auth.middleware");
const { requirePermission } = require("../middleware/permission.middleware");
const staffController = require("../controllers/staff.controller");
const {
  staffIdParamValidator,
  createStaffValidator,
  updateStaffValidator,
  assignStaffRoleValidator,
  updateStaffStatusValidator,
} = require("../validators/staff.validator");

const router = express.Router();

// All /api/admin routes require authenticated staff session
router.use(authenticate);

// Roles & permissions (read-only)
router.get("/roles", requirePermission(PERMISSIONS.ROLES_READ), staffController.listRoles);
router.get(
  "/permissions",
  requirePermission(PERMISSIONS.ROLES_READ),
  staffController.listPermissions
);

// Staff management
router.get("/staff", requirePermission(PERMISSIONS.STAFF_READ), staffController.listStaff);
router.post(
  "/staff",
  requireCsrf,
  requirePermission(PERMISSIONS.STAFF_CREATE),
  createStaffValidator,
  validate,
  staffController.createStaff
);
router.get(
  "/staff/:id",
  requirePermission(PERMISSIONS.STAFF_READ),
  staffIdParamValidator,
  validate,
  staffController.getStaffById
);
router.patch(
  "/staff/:id",
  requireCsrf,
  requirePermission(PERMISSIONS.STAFF_UPDATE),
  updateStaffValidator,
  validate,
  staffController.updateStaff
);
router.patch(
  "/staff/:id/role",
  requireCsrf,
  requirePermission(PERMISSIONS.ROLES_MANAGE),
  assignStaffRoleValidator,
  validate,
  staffController.assignStaffRole
);
router.patch(
  "/staff/:id/status",
  requireCsrf,
  requirePermission(PERMISSIONS.STAFF_UPDATE),
  updateStaffStatusValidator,
  validate,
  staffController.updateStaffStatus
);

// Audit logs
router.get(
  "/audit-logs",
  requirePermission(PERMISSIONS.AUDIT_LOGS_READ),
  staffController.listAuditLogs
);

module.exports = router;
