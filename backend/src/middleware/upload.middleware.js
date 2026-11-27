const multer = require("multer");
const httpStatus = require("../constants/httpStatus");
const ApiError = require("../utils/ApiError");

const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_BYTES,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(
        new ApiError(
          httpStatus.BAD_REQUEST,
          "Unsupported image type. Only JPEG, PNG, and WebP images are allowed."
        )
      );
    }
    return cb(null, true);
  },
});

function hasValidImageMagicBytes(buffer, mimetype) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) {
    return false;
  }

  if (mimetype === "image/jpeg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimetype === "image/png") {
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  }
  if (mimetype === "image/webp") {
    return (
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }
  return false;
}

const uploadSingleProductImage = [
  upload.single("image"),
  (req, res, next) => {
    if (!req.file) {
      return next(new ApiError(httpStatus.BAD_REQUEST, 'Image file field "image" is required'));
    }
    if (!hasValidImageMagicBytes(req.file.buffer, req.file.mimetype)) {
      return next(
        new ApiError(
          httpStatus.BAD_REQUEST,
          "File signature does not match an allowed JPEG, PNG, or WebP image"
        )
      );
    }
    return next();
  },
];

module.exports = {
  MAX_IMAGE_BYTES,
  ALLOWED_MIME_TYPES,
  hasValidImageMagicBytes,
  uploadSingleProductImage,
};
