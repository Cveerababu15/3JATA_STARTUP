const fs = require("fs");
const path = require("path");
const request = require("supertest");
const app = require("../../src/app");
const User = require("../../src/models/User.model");
const Session = require("../../src/models/Session.model");
const AuthToken = require("../../src/models/AuthToken.model");
const { LOCAL_EMAIL_DIR } = require("../../src/services/email.service");
const {
  startTestDatabase,
  clearTestDatabase,
  stopTestDatabase,
} = require("../helpers/mongoMemory");

async function cleanLocalEmails() {
  if (fs.existsSync(LOCAL_EMAIL_DIR)) {
    const files = await fs.promises.readdir(LOCAL_EMAIL_DIR);
    await Promise.all(files.map((f) => fs.promises.unlink(path.join(LOCAL_EMAIL_DIR, f))));
  }
}

async function getLatestEmailFor(recipientEmail) {
  const files = await fs.promises.readdir(LOCAL_EMAIL_DIR);
  const matching = files
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse();

  for (const file of matching) {
    const content = JSON.parse(
      await fs.promises.readFile(path.join(LOCAL_EMAIL_DIR, file), "utf8")
    );
    if (content.to === recipientEmail) {
      return content;
    }
  }
  return null;
}

describe("B1.3 Authentication (Integration)", () => {
  beforeAll(async () => {
    await startTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();
    await cleanLocalEmails();
  });

  afterAll(async () => {
    await cleanLocalEmails();
    await stopTestDatabase();
  });

  it("registers a customer, rejects privileged fields, handles duplicate email, and verifies email with single-use token", async () => {
    // Reject privileged fields during public registration
    const badReg = await request(app).post("/api/auth/register").send({
      name: "Attacker",
      email: "attacker@example.com",
      password: "Password123",
      role: "super_admin",
      isEmailVerified: true,
    });
    expect(badReg.status).toBe(400);

    // Valid registration
    const regRes = await request(app).post("/api/auth/register").send({
      name: "Asha Sharma",
      email: "asha@example.com",
      password: "Password123",
    });

    expect(regRes.status).toBe(201);
    expect(regRes.body.success).toBe(true);
    expect(regRes.body.data.user.email).toBe("asha@example.com");
    expect(regRes.body.data.user.userType).toBe("customer");
    expect(regRes.body.data.user.isEmailVerified).toBe(false);
    expect(regRes.body.data.user.passwordHash).toBeUndefined();
    expect(regRes.body.data.token).toBeUndefined();

    // Duplicate email -> 409
    const dupRes = await request(app).post("/api/auth/register").send({
      name: "Asha Duplicate",
      email: "ASHA@example.com",
      password: "Password123",
    });
    expect(dupRes.status).toBe(409);

    // Unverified login blocked
    const unverifiedLogin = await request(app).post("/api/auth/login").send({
      email: "asha@example.com",
      password: "Password123",
    });
    expect(unverifiedLogin.status).toBe(403);

    // Verification email saved by local adapter
    const emailPayload = await getLatestEmailFor("asha@example.com");
    expect(emailPayload).not.toBeNull();
    const token = emailPayload.meta.token;
    expect(token).toBeDefined();

    // Verify email
    const verifyRes = await request(app).post("/api/auth/verify-email").send({ token });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.user.isEmailVerified).toBe(true);

    // Single-use token cannot be reused
    const reuseRes = await request(app).post("/api/auth/verify-email").send({ token });
    expect(reuseRes.status).toBe(400);
  });

  it("supports login with HttpOnly cookies, CSRF protection, /me, logout, and session expiry", async () => {
    await request(app).post("/api/auth/register").send({
      name: "Ravi Kumar",
      email: "ravi@example.com",
      password: "Password123",
    });
    const email = await getLatestEmailFor("ravi@example.com");
    await request(app).post("/api/auth/verify-email").send({ token: email.meta.token });

    // Wrong password returns generic 401
    const badLogin = await request(app).post("/api/auth/login").send({
      email: "ravi@example.com",
      password: "WrongPassword1",
    });
    expect(badLogin.status).toBe(401);

    // Unknown email returns same generic 401 (anti-enumeration)
    const unknownLogin = await request(app).post("/api/auth/login").send({
      email: "nobody@example.com",
      password: "Password123",
    });
    expect(unknownLogin.status).toBe(401);
    expect(unknownLogin.body.message).toBe(badLogin.body.message);

    const agent = request.agent(app);
    const loginRes = await agent.post("/api/auth/login").send({
      email: "ravi@example.com",
      password: "Password123",
    });

    expect(loginRes.status).toBe(200);
    const csrfToken = loginRes.body.data.csrfToken;
    expect(csrfToken).toBeDefined();
    const setCookies = loginRes.headers["set-cookie"].join(";");
    expect(setCookies).toContain("3jata_sid=");
    expect(setCookies).toContain("HttpOnly");

    // GET /me and GET /csrf-token work with cookie
    const meRes = await agent.get("/api/auth/me");
    expect(meRes.status).toBe(200);
    expect(meRes.body.data.user.email).toBe("ravi@example.com");
    expect(meRes.body.data.user.passwordHash).toBeUndefined();

    const csrfRes = await agent.get("/api/auth/csrf-token");
    expect(csrfRes.status).toBe(200);
    expect(csrfRes.body.data.csrfToken).toBe(csrfToken);

    const readyRes = await request(app).get("/api/health/ready");
    expect(readyRes.status).toBe(200);
    expect(readyRes.body.data.status).toBe("ready");

    // Cross-session CSRF misuse: User B's cookie paired with User A's CSRF header & CSRF cookie -> 403
    await request(app).post("/api/auth/register").send({
      name: "Second User",
      email: "second@example.com",
      password: "Password123",
    });
    const secondMail = await getLatestEmailFor("second@example.com");
    await request(app).post("/api/auth/verify-email").send({ token: secondMail.meta.token });
    const secondLogin = await request(app).post("/api/auth/login").send({
      email: "second@example.com",
      password: "Password123",
    });
    const secondCsrf = secondLogin.body.data.csrfToken;
    const raviCookies = loginRes.headers["set-cookie"].find((c) => c.startsWith("3jata_sid="));
    const raviSidPair = raviCookies.split(";")[0];

    const crossCsrfRes = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", [raviSidPair, `3jata_csrf=${secondCsrf}`])
      .set("X-CSRF-Token", secondCsrf);
    expect(crossCsrfRes.status).toBe(403);

    // State-changing POST without X-CSRF-Token is blocked
    const noCsrfLogout = await agent.post("/api/auth/logout");
    expect(noCsrfLogout.status).toBe(403);

    // Logout with valid CSRF token revokes session
    const logoutRes = await agent.post("/api/auth/logout").set("X-CSRF-Token", csrfToken);
    expect(logoutRes.status).toBe(200);

    // Subsequent /me is rejected
    const afterLogout = await agent.get("/api/auth/me");
    expect(afterLogout.status).toBe(401);

    // Expired session is rejected
    const loginAgain = await agent.post("/api/auth/login").send({
      email: "ravi@example.com",
      password: "Password123",
    });
    expect(loginAgain.status).toBe(200);
    await Session.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });

    const expiredMe = await agent.get("/api/auth/me");
    expect(expiredMe.status).toBe(401);
  });

  it("blocks suspended users immediately on authenticated endpoints", async () => {
    await request(app).post("/api/auth/register").send({
      name: "Meera Nair",
      email: "meera@example.com",
      password: "Password123",
    });
    const email = await getLatestEmailFor("meera@example.com");
    await request(app).post("/api/auth/verify-email").send({ token: email.meta.token });

    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({
      email: "meera@example.com",
      password: "Password123",
    });

    await User.updateOne({ email: "meera@example.com" }, { $set: { status: "suspended" } });

    const meRes = await agent.get("/api/auth/me");
    expect(meRes.status).toBe(403);
  });

  it("invalidates existing sessions on change-password and forgot/reset-password", async () => {
    await request(app).post("/api/auth/register").send({
      name: "Kiran Patel",
      email: "kiran@example.com",
      password: "Password123",
    });
    const verifyMail = await getLatestEmailFor("kiran@example.com");
    await request(app).post("/api/auth/verify-email").send({ token: verifyMail.meta.token });

    const agent = request.agent(app);
    const loginRes = await agent.post("/api/auth/login").send({
      email: "kiran@example.com",
      password: "Password123",
    });
    const csrfToken = loginRes.body.data.csrfToken;

    // Change password revokes active session
    const changeRes = await agent
      .patch("/api/auth/change-password")
      .set("X-CSRF-Token", csrfToken)
      .send({
        currentPassword: "Password123",
        newPassword: "NewPassword456",
      });
    expect(changeRes.status).toBe(200);

    const meAfterChange = await agent.get("/api/auth/me");
    expect(meAfterChange.status).toBe(401);

    // Forgot password returns anti-enumeration 200 even for unknown emails
    const unknownForgot = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "doesnotexist@example.com" });
    expect(unknownForgot.status).toBe(200);

    const forgotRes = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "kiran@example.com" });
    expect(forgotRes.status).toBe(200);

    const resetMail = await getLatestEmailFor("kiran@example.com");
    expect(resetMail.meta.purpose).toBe("password_reset");

    // Verify token hash stored, not plaintext
    const storedToken = await AuthToken.findOne({ purpose: "password_reset", usedAt: null }).lean();
    expect(storedToken.tokenHash).not.toBe(resetMail.meta.token);

    // Reset password
    const resetRes = await request(app).post("/api/auth/reset-password").send({
      token: resetMail.meta.token,
      newPassword: "ResetPassword789",
    });
    expect(resetRes.status).toBe(200);

    // Reset token is single-use
    const reuseReset = await request(app).post("/api/auth/reset-password").send({
      token: resetMail.meta.token,
      newPassword: "AnotherPassword789",
    });
    expect(reuseReset.status).toBe(400);

    // Login with new password succeeds
    const finalLogin = await request(app).post("/api/auth/login").send({
      email: "kiran@example.com",
      password: "ResetPassword789",
    });
    expect(finalLogin.status).toBe(200);
  });

  it("supports resend verification without enumerating accounts", async () => {
    await request(app).post("/api/auth/register").send({
      name: "Neha Rao",
      email: "neha@example.com",
      password: "Password123",
    });

    const firstEmail = await getLatestEmailFor("neha@example.com");
    const firstToken = firstEmail.meta.token;

    const resendUnknown = await request(app)
      .post("/api/auth/resend-verification")
      .send({ email: "missing@example.com" });
    expect(resendUnknown.status).toBe(200);

    const resendKnown = await request(app)
      .post("/api/auth/resend-verification")
      .send({ email: "neha@example.com" });
    expect(resendKnown.status).toBe(200);
    expect(resendKnown.body.message).toBe(resendUnknown.body.message);

    // Old token invalidated when new one was issued
    const oldTry = await request(app).post("/api/auth/verify-email").send({ token: firstToken });
    expect(oldTry.status).toBe(400);

    const secondEmail = await getLatestEmailFor("neha@example.com");

    // Expired verification token is rejected
    await AuthToken.updateMany(
      { purpose: "email_verification", usedAt: null },
      { $set: { expiresAt: new Date(Date.now() - 1000) } }
    );
    const expiredVerify = await request(app)
      .post("/api/auth/verify-email")
      .send({ token: secondEmail.meta.token });
    expect(expiredVerify.status).toBe(400);

    // Resend fresh token, verify, then verify expired password reset token fails
    await request(app).post("/api/auth/resend-verification").send({ email: "neha@example.com" });
    const thirdEmail = await getLatestEmailFor("neha@example.com");
    const newTry = await request(app)
      .post("/api/auth/verify-email")
      .send({ token: thirdEmail.meta.token });
    expect(newTry.status).toBe(200);

    await request(app).post("/api/auth/forgot-password").send({ email: "neha@example.com" });
    const resetMail = await getLatestEmailFor("neha@example.com");
    await AuthToken.updateMany(
      { purpose: "password_reset", usedAt: null },
      { $set: { expiresAt: new Date(Date.now() - 1000) } }
    );
    const expiredReset = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: resetMail.meta.token, newPassword: "NewPassword999" });
    expect(expiredReset.status).toBe(400);
  });
});
