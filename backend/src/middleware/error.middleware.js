const env = require("../config/env");
const httpStatus = require("../constants/httpStatus");
const messages = require("../constants/messages");
const ApiError = require("../utils/ApiError");
const apiResponse = require("../utils/apiResponse");

function normalizeError(err) {
  if (err instanceof ApiError) {
    return err;
  }

  // Malformed JSON body
  if (err.type === "entity.parse.failed" || (err instanceof SyntaxError && err.status === 400)) {
    return new ApiError(httpStatus.BAD_REQUEST, "Invalid JSON payload");
  }

  // Request payload exceeds configured body limit
  if (err.type === "entity.too.large" || err.status === 413) {
    return new ApiError(httpStatus.PAYLOAD_TOO_LARGE, "Request payload exceeds size limit");
  }

  // Multer upload errors
  if (err.name === "MulterError") {
    if (err.code === "LIMIT_FILE_SIZE") {
      return new ApiError(
        httpStatus.PAYLOAD_TOO_LARGE,
        "Uploaded file exceeds maximum allowed size"
      );
    }
    return new ApiError(httpStatus.BAD_REQUEST, err.message || "Invalid file upload");
  }

  // Mongoose invalid ObjectId / type cast
  if (err.name === "CastError") {
    return new ApiError(httpStatus.BAD_REQUEST, `Invalid ${err.path || "identifier"} format`);
  }

  // Mongoose schema validation failure
  if (err.name === "ValidationError") {
    const errors = Object.values(err.errors || {}).map((item) => ({
      field: item.path || "field",
      message: item.message,
    }));
    return new ApiError(httpStatus.BAD_REQUEST, messages.VALIDATION_FAILED, errors);
  }

  // MongoDB duplicate key error
  if (err.code === 11000) {
    const fields = Object.keys(err.keyPattern || err.keyValue || {});
    const fieldLabel = fields.length > 0 ? fields.join(", ") : "resource";
    return new ApiError(httpStatus.CONFLICT, `${fieldLabel} already exists`, [
      { field: fieldLabel, message: "Duplicate value is not allowed" },
    ]);
  }

  // CORS origin rejection
  if (err.message === "Origin not allowed by CORS") {
    return new ApiError(httpStatus.FORBIDDEN, "CORS origin not allowed");
  }

  return new ApiError(
    err.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
    messages.INTERNAL_SERVER_ERROR,
    [],
    false
  );
}

// eslint-disable-next-line no-unused-vars
const errorMiddleware = (err, req, res, next) => {
  const normalized = normalizeError(err);

  if (!env.isTest && (!normalized.isOperational || normalized.statusCode >= 500)) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        requestId: req.id || null,
        level: "error",
        message: err.message,
        ...(env.isProduction ? {} : { stack: err.stack }),
      })
    );
  }

  const responseMessage =
    !normalized.isOperational && env.isProduction
      ? messages.INTERNAL_SERVER_ERROR
      : normalized.message || messages.INTERNAL_SERVER_ERROR;

  return apiResponse.error(res, responseMessage, normalized.errors || [], normalized.statusCode);
};

module.exports = errorMiddleware;
