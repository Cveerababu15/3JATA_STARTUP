const fs = require("fs");

jest.mock("nodemailer");

describe("Email Service (Local Adapter & Mocked SMTP)", () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("writes preview JSON file in local mode without exposing secrets", async () => {
    process.env.EMAIL_MODE = "local";
    const emailService = require("../../src/services/email.service");

    const res = await emailService.sendVerificationEmail({
      to: "localtest@example.com",
      name: "Local Tester",
      token: "a".repeat(64),
    });

    expect(res.mode).toBe("local");
    expect(fs.existsSync(res.previewFile)).toBe(true);
    await fs.promises.unlink(res.previewFile);
  });

  it("uses nodemailer SMTP transport when EMAIL_MODE=smtp", async () => {
    process.env.EMAIL_MODE = "smtp";
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "mailer";
    process.env.SMTP_PASS = "secret";

    const sendMailMock = jest.fn().mockResolvedValue({ messageId: "msg-123" });
    const mockedNodemailer = require("nodemailer");
    mockedNodemailer.createTransport.mockReturnValue({ sendMail: sendMailMock });

    const emailService = require("../../src/services/email.service");
    const res = await emailService.sendPasswordResetEmail({
      to: "smtpuser@example.com",
      name: "SMTP User",
      token: "b".repeat(64),
    });

    expect(mockedNodemailer.createTransport).toHaveBeenCalledTimes(1);
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect(res).toEqual({ delivered: true, mode: "smtp", messageId: "msg-123" });

    process.env.EMAIL_MODE = "local";
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
  });
});
