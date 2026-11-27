const mongoose = require("mongoose");

const TOKEN_PURPOSES = ["email_verification", "password_reset"];

const authTokenSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    purpose: {
      type: String,
      enum: TOKEN_PURPOSES,
      required: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    usedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

authTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
authTokenSchema.index({ user: 1, purpose: 1, usedAt: 1 });

const AuthToken = mongoose.model("AuthToken", authTokenSchema);

module.exports = AuthToken;
module.exports.TOKEN_PURPOSES = TOKEN_PURPOSES;
