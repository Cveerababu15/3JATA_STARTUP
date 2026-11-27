const httpStatus = require("../constants/httpStatus");
const apiResponse = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const staffService = require("../services/staff.service");

const listRoles = asyncHandler(async (req, res) => {
  const roles = await staffService.listRoles();
  return apiResponse.success(res, "Roles fetched successfully", { roles }, httpStatus.OK);
});

const listPermissions = asyncHandler(async (req, res) => {
  const permissions = await staffService.listPermissions();
  return apiResponse.success(
    res,
    "Permissions fetched successfully",
    { permissions },
    httpStatus.OK
  );
});

const createStaff = asyncHandler(async (req, res) => {
  const { name, email, password, roleId, roleSlug } = req.body;
  const staff = await staffService.createStaff({
    actor: req.user,
    name,
    email,
    password,
    roleId,
    roleSlug,
  });

  return apiResponse.success(
    res,
    "Staff account created successfully",
    { staff },
    httpStatus.CREATED
  );
});

const listStaff = asyncHandler(async (req, res) => {
  const { items, pagination } = await staffService.listStaff(req.query);
  return apiResponse.paginated(res, "Staff accounts fetched successfully", items, pagination);
});

const getStaffById = asyncHandler(async (req, res) => {
  const staff = await staffService.getStaffById(req.params.id);
  return apiResponse.success(res, "Staff account fetched successfully", { staff }, httpStatus.OK);
});

const updateStaff = asyncHandler(async (req, res) => {
  const staff = await staffService.updateStaff({
    actor: req.user,
    staffId: req.params.id,
    name: req.body.name,
  });

  return apiResponse.success(res, "Staff account updated successfully", { staff }, httpStatus.OK);
});

const assignStaffRole = asyncHandler(async (req, res) => {
  const staff = await staffService.assignStaffRole({
    actor: req.user,
    staffId: req.params.id,
    roleId: req.body.roleId,
    roleSlug: req.body.roleSlug,
  });

  return apiResponse.success(res, "Staff role updated successfully", { staff }, httpStatus.OK);
});

const updateStaffStatus = asyncHandler(async (req, res) => {
  const staff = await staffService.updateStaffStatus({
    actor: req.user,
    staffId: req.params.id,
    status: req.body.status,
    reason: req.body.reason,
  });

  return apiResponse.success(res, "Staff status updated successfully", { staff }, httpStatus.OK);
});

const listAuditLogs = asyncHandler(async (req, res) => {
  const { items, pagination } = await staffService.listAuditLogs(req.query);
  return apiResponse.paginated(res, "Audit logs fetched successfully", items, pagination);
});

module.exports = {
  listRoles,
  listPermissions,
  createStaff,
  listStaff,
  getStaffById,
  updateStaff,
  assignStaffRole,
  updateStaffStatus,
  listAuditLogs,
};
