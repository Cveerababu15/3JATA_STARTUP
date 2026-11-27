const Permission = require("../models/Permission.model");
const Role = require("../models/Role.model");
const { PERMISSION_DEFINITIONS, ROLE_DEFINITIONS } = require("../constants/rolePermissions");

/**
 * Idempotently seeds all permissions and documented customer/staff roles.
 * Safe to run repeatedly on startup or via `npm run seed`.
 */
async function seedRolesAndPermissions() {
  const permissionOps = PERMISSION_DEFINITIONS.map((perm) => ({
    updateOne: {
      filter: { code: perm.code },
      update: {
        $set: {
          resource: perm.resource,
          action: perm.action,
          description: perm.description,
        },
      },
      upsert: true,
    },
  }));

  if (permissionOps.length > 0) {
    await Permission.bulkWrite(permissionOps);
  }

  const allPermissions = await Permission.find({}).select("_id code").lean();
  const permissionIdByCode = new Map(allPermissions.map((p) => [p.code, p._id]));

  for (const roleDef of ROLE_DEFINITIONS) {
    const permissionIds = roleDef.permissions
      .map((code) => permissionIdByCode.get(code))
      .filter(Boolean);

    await Role.findOneAndUpdate(
      { slug: roleDef.slug },
      {
        $set: {
          name: roleDef.name,
          description: roleDef.description,
          isStaffRole: roleDef.isStaffRole,
          isSystem: roleDef.isSystem,
          isActive: true,
          permissions: permissionIds,
        },
      },
      { upsert: true, returnDocument: "after" }
    );
  }

  return {
    permissionsCount: permissionOps.length,
    rolesCount: ROLE_DEFINITIONS.length,
  };
}

module.exports = {
  seedRolesAndPermissions,
};
