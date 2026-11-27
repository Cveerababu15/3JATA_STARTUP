const { v2: cloudinary } = require("cloudinary");
const env = require("../config/env");

function isCloudinaryConfigured() {
  return Boolean(env.cloudinaryCloudName && env.cloudinaryApiKey && env.cloudinaryApiSecret);
}

function getConfiguredCloudinary() {
  if (!isCloudinaryConfigured()) {
    return null;
  }

  cloudinary.config({
    cloud_name: env.cloudinaryCloudName,
    api_key: env.cloudinaryApiKey,
    api_secret: env.cloudinaryApiSecret,
    secure: true,
  });

  return cloudinary;
}

module.exports = {
  isCloudinaryConfigured,
  getConfiguredCloudinary,
};
