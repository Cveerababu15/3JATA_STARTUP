const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    csrfToken: {
      type: String,
      required: true,
    },
    userAgent: {
      type: String,
      default: "",
      maxlength: 255,
    },
    ipAddress: {
      type: String,
      default: "",
      maxlength: 64,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    revokedReason: {
      type: String,
      default: null,
      maxlength: 100,
    },
  },
  {
    timestamps: true,
  }
);

// MongoDB TTL index removes expired session documents automatically
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
sessionSchema.index({ user: 1, revokedAt: 1 });

const Session = mongoose.model("Session", sessionSchema);

module.exports = Session;
