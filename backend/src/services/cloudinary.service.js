const env = require("../config/env");
const httpStatus = require("../constants/httpStatus");
const ApiError = require("../utils/ApiError");
const { getConfiguredCloudinary } = require("../config/cloudinary");

async function uploadProductImageBuffer({ buffer, productId, filename }) {
  const client = getConfiguredCloudinary();
  if (!client) {
    throw new ApiError(
      httpStatus.SERVICE_UNAVAILABLE,
      "Cloudinary credentials are not configured on this server"
    );
  }

  const folder = `${env.cloudinaryFolder}/${productId}`;

  return new Promise((resolve, reject) => {
    const uploadStream = client.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        use_filename: true,
        unique_filename: true,
        filename_override: filename,
      },
      (error, result) => {
        if (error) {
          return reject(
            new ApiError(
              httpStatus.SERVICE_UNAVAILABLE,
              `Image upload failed: ${error.message || "Cloudinary error"}`
            )
          );
        }
        return resolve({
          url: result.secure_url,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
          format: result.format,
        });
      }
    );

    uploadStream.end(buffer);
  });
}

async function deleteCloudinaryImage(publicId) {
  const client = getConfiguredCloudinary();
  if (!client) {
    throw new ApiError(
      httpStatus.SERVICE_UNAVAILABLE,
      "Cloudinary credentials are not configured on this server"
    );
  }

  const result = await client.uploader.destroy(publicId, { resource_type: "image" });
  if (result && result.result !== "ok" && result.result !== "not found") {
    throw new ApiError(
      httpStatus.SERVICE_UNAVAILABLE,
      `Failed to delete image from Cloudinary: ${result.result}`
    );
  }
  return result;
}

module.exports = {
  uploadProductImageBuffer,
  deleteCloudinaryImage,
};
