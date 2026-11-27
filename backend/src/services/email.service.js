const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");
const env = require("../config/env");

const LOCAL_EMAIL_DIR = path.resolve(__dirname, "../../tmp/local-emails");

function createSmtpTransport() {
  if (!env.smtpHost || !env.smtpUser || !env.smtpPass) {
    throw new Error("SMTP configuration is incomplete (SMTP_HOST, SMTP_USER, SMTP_PASS required)");
  }

  return nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass,
    },
  });
}

/**
 * Local Development Email Adapter:
 * Writes email previews to backend/tmp/local-emails/ so developers can inspect
 * verification and reset links locally without exposing tokens in API responses.
 */
async function sendViaLocalAdapter({ to, subject, text, html, meta = {} }) {
  await fs.promises.mkdir(LOCAL_EMAIL_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeRecipient = String(to).replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = `${timestamp}_${safeRecipient}.json`;
  const filePath = path.join(LOCAL_EMAIL_DIR, filename);

  const payload = {
    adapter: "LOCAL_DEVELOPMENT_EMAIL_ADAPTER",
    createdAt: new Date().toISOString(),
    from: env.emailFrom,
    to,
    subject,
    text,
    html,
    meta,
  };

  await fs.promises.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");

  if (!env.isTest) {
    console.log(`[LOCAL EMAIL ADAPTER] Email saved for ${to}: ${filePath}`);
  }

  return {
    delivered: true,
    mode: "local",
    previewFile: filePath,
  };
}

async function sendEmail({ to, subject, text, html, meta = {} }) {
  if (env.emailMode === "smtp") {
    const transporter = createSmtpTransport();
    const info = await transporter.sendMail({
      from: env.emailFrom,
      to,
      subject,
      text,
      html,
    });
    return {
      delivered: true,
      mode: "smtp",
      messageId: info.messageId,
    };
  }

  return sendViaLocalAdapter({ to, subject, text, html, meta });
}

async function sendVerificationEmail({ to, name, token }) {
  const verifyUrl = `${env.clientUrl}/verify-email?token=${token}`;
  return sendEmail({
    to,
    subject: "Verify your 3JATA account email",
    text: `Hello ${name},\n\nPlease verify your email using this token: ${token}\nOr open: ${verifyUrl}\n\nThis link expires in 24 hours.`,
    html: `<p>Hello ${name},</p><p>Verify your email by clicking <a href="${verifyUrl}">Verify Email</a> or submitting token <code>${token}</code>.</p><p>This link expires in 24 hours.</p>`,
    meta: { purpose: "email_verification", token, verifyUrl },
  });
}

async function sendPasswordResetEmail({ to, name, token }) {
  const resetUrl = `${env.clientUrl}/reset-password?token=${token}`;
  return sendEmail({
    to,
    subject: "Reset your 3JATA account password",
    text: `Hello ${name},\n\nUse this password reset token: ${token}\nOr open: ${resetUrl}\n\nThis link expires in 30 minutes.`,
    html: `<p>Hello ${name},</p><p>Reset your password by clicking <a href="${resetUrl}">Reset Password</a> or submitting token <code>${token}</code>.</p><p>This link expires in 30 minutes.</p>`,
    meta: { purpose: "password_reset", token, resetUrl },
  });
}

async function verifySmtpConnection() {
  const transporter = createSmtpTransport();
  await transporter.verify();
  return { verified: true };
}

module.exports = {
  LOCAL_EMAIL_DIR,
  createSmtpTransport,
  verifySmtpConnection,
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
};
