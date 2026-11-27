const env = require("../config/env");
const { connectDatabase, disconnectDatabase } = require("../config/database");
const { seedRolesAndPermissions } = require("../utils/seedRoles");

async function runSeed() {
  try {
    env.validateEnv();
    await connectDatabase();
    const summary = await seedRolesAndPermissions();
    console.log(
      `Seed complete: ${summary.permissionsCount} permissions, ${summary.rolesCount} roles synced.`
    );
    await disconnectDatabase();
    process.exit(0);
  } catch (err) {
    console.error("Seed failed:", err.message);
    await disconnectDatabase().catch(() => {});
    process.exit(1);
  }
}

runSeed();
