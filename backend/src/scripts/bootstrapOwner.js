const readline = require("readline");
const bcrypt = require("bcryptjs");
const env = require("../config/env");
const { connectDatabase, disconnectDatabase } = require("../config/database");
const { seedRolesAndPermissions } = require("../utils/seedRoles");
const ROLES = require("../constants/roles");
const Role = require("../models/Role.model");
const User = require("../models/User.model");
const { recordAudit } = require("../services/audit.service");
const { PASSWORD_REGEX, PASSWORD_MSG } = require("../validators/auth.validator");

function parseCliArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith("--")) {
      const [key, inlineVal] = token.slice(2).split("=");
      if (inlineVal !== undefined) {
        args[key] = inlineVal;
      } else if (argv[i + 1] && !argv[i + 1].startsWith("--")) {
        args[key] = argv[i + 1];
        i += 1;
      }
    }
  }
  return args;
}

function askQuestion(question, { hidden = false } = {}) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    if (!hidden) {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer);
      });
      return;
    }

    // Mask password characters in interactive terminal
    const onData = (char) => {
      const code = char.toString();
      if (code === "\n" || code === "\r" || code === "\u0004") {
        process.stdin.removeListener("data", onData);
      } else {
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);
        process.stdout.write(`${question}${"*".repeat(rl.line.length)}`);
      }
    };
    process.stdin.on("data", onData);
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

async function bootstrapOwner() {
  try {
    env.validateEnv();
    await connectDatabase();
    await seedRolesAndPermissions();

    const superAdminRole = await Role.findOne({ slug: ROLES.SUPER_ADMIN });
    if (!superAdminRole) {
      throw new Error("Super Admin role could not be loaded");
    }

    const existingOwner = await User.findOne({
      userType: "staff",
      role: superAdminRole._id,
      status: "active",
    }).select("email name");

    if (existingOwner) {
      console.log(`An active owner already exists (${existingOwner.email}). No changes made.`);
      await disconnectDatabase();
      process.exit(0);
    }

    const args = parseCliArgs(process.argv.slice(2));
    const name = (
      args.name ||
      process.env.OWNER_NAME ||
      (await askQuestion("Owner Name: "))
    ).trim();
    const email = (args.email || process.env.OWNER_EMAIL || (await askQuestion("Owner Email: ")))
      .trim()
      .toLowerCase();
    const password =
      args.password ||
      process.env.OWNER_PASSWORD ||
      (await askQuestion("Owner Password: ", { hidden: true }));

    if (!name || name.length < 2) {
      throw new Error("Owner name must be at least 2 characters");
    }
    if (!email || !email.includes("@")) {
      throw new Error("Valid owner email is required");
    }
    if (!PASSWORD_REGEX.test(password || "")) {
      throw new Error(PASSWORD_MSG);
    }

    const duplicate = await User.findOne({ email }).select("_id").lean();
    if (duplicate) {
      throw new Error(`An account with email ${email} already exists`);
    }

    const passwordHash = await bcrypt.hash(password, env.bcryptRounds);
    const owner = await User.create({
      name,
      email,
      passwordHash,
      userType: "staff",
      role: superAdminRole._id,
      status: "active",
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
    });

    await recordAudit({
      actorId: owner._id,
      actorEmail: owner.email,
      action: "owner.bootstrapped",
      resourceType: "User",
      resourceId: owner._id,
      after: {
        name: owner.name,
        email: owner.email,
        role: ROLES.SUPER_ADMIN,
      },
    });

    console.log(`Owner bootstrapped successfully: ${owner.email}`);
    await disconnectDatabase();
    process.exit(0);
  } catch (err) {
    console.error("Owner bootstrap failed:", err.message);
    await disconnectDatabase().catch(() => {});
    process.exit(1);
  }
}

bootstrapOwner();
