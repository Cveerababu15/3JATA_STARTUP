const path = require("path");
const dotenv = require("dotenv");

// Load backend/.env even if node is started from the repository root (skip in test mode for isolation)
if (process.env.NODE_ENV !== "test") {
  dotenv.config({
    path: path.resolve(__dirname, "../../.env"),
    override: false,
    quiet: true,
  });
}

const VALID_NODE_ENVS = new Set(["development", "test", "production"]);
const VALID_EMAIL_MODES = new Set(["local", "smtp"]);

function parseList(value, fallback = []) {
  if (!value || !String(value).trim()) {
    return fallback;
  }
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parsePositiveInt(value, fallback, name) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid environment variable ${name}: must be a positive integer`);
  }
  return parsed;
}

const nodeEnv = process.env.NODE_ENV || "development";
if (!VALID_NODE_ENVS.has(nodeEnv)) {
  throw new Error(`Invalid NODE_ENV "${nodeEnv}". Expected one of: development, test, production`);
}

const emailMode = process.env.EMAIL_MODE || (nodeEnv === "production" ? "smtp" : "local");
if (!VALID_EMAIL_MODES.has(emailMode)) {
  throw new Error(`Invalid EMAIL_MODE "${emailMode}". Expected "local" or "smtp"`);
}

const defaultCorsOrigins =
  nodeEnv === "production" ? [] : ["http://localhost:5173", "http://127.0.0.1:5173"];

const env = {
  nodeEnv,
  isProduction: nodeEnv === "production",
  isTest: nodeEnv === "test",
  port: parsePositiveInt(process.env.PORT, 5000, "PORT"),
  mongodbUri: process.env.MONGODB_URI || "",
  mongodbTestUri: process.env.MONGODB_TEST_URI || "",
  corsOrigins: parseList(process.env.CORS_ORIGINS || process.env.CLIENT_URL, defaultCorsOrigins),
  jsonBodyLimit: process.env.JSON_BODY_LIMIT || "100kb",
  rateLimitWindowMs: parsePositiveInt(
    process.env.RATE_LIMIT_WINDOW_MS,
    15 * 60 * 1000,
    "RATE_LIMIT_WINDOW_MS"
  ),
  rateLimitMax: parsePositiveInt(process.env.RATE_LIMIT_MAX, 100, "RATE_LIMIT_MAX"),
  trustProxy: process.env.TRUST_PROXY === "true",

  // Auth & cookie settings (used in B1.3+)
  sessionTtlHours: parsePositiveInt(process.env.SESSION_TTL_HOURS, 24 * 7, "SESSION_TTL_HOURS"),
  sessionCookieName: process.env.SESSION_COOKIE_NAME || "3jata_sid",
  csrfCookieName: process.env.CSRF_COOKIE_NAME || "3jata_csrf",
  cookieSecure:
    process.env.COOKIE_SECURE !== undefined
      ? process.env.COOKIE_SECURE === "true"
      : nodeEnv === "production",
  cookieSameSite: process.env.COOKIE_SAME_SITE || "lax",
  appBaseUrl: process.env.APP_BASE_URL || "http://localhost:5000",
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  bcryptRounds: parsePositiveInt(
    process.env.BCRYPT_ROUNDS,
    nodeEnv === "test" ? 4 : 12,
    "BCRYPT_ROUNDS"
  ),

  // Email settings (used in B1.3+)
  emailMode,
  emailFrom: process.env.EMAIL_FROM || "no-reply@3jata.local",
  smtpHost: process.env.SMTP_HOST || "",
  smtpPort: parsePositiveInt(process.env.SMTP_PORT, 587, "SMTP_PORT"),
  smtpSecure: process.env.SMTP_SECURE === "true",
  smtpUser: process.env.SMTP_USER || "",
  smtpPass: process.env.SMTP_PASS || "",

  // Cloudinary settings (used in B1.5+)
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || "",
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || "",
  cloudinaryFolder: process.env.CLOUDINARY_FOLDER || "3jata/products",
};

/**
 * Validates required runtime configuration before booting the HTTP server.
 * Kept as a function so unit tests can import `app` without requiring live Atlas credentials.
 */
function validateEnv() {
  const missing = [];

  if (!env.isTest && !env.mongodbUri) {
    missing.push("MONGODB_URI");
  }

  if (env.isProduction) {
    if (env.corsOrigins.length === 0) {
      missing.push("CORS_ORIGINS (or CLIENT_URL)");
    }
    if (env.emailMode === "smtp") {
      if (!env.smtpHost) missing.push("SMTP_HOST");
      if (!env.smtpUser) missing.push("SMTP_USER");
      if (!env.smtpPass) missing.push("SMTP_PASS");
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

env.validateEnv = validateEnv;

module.exports = env;
