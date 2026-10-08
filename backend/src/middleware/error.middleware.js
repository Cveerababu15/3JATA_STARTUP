const httpStatus = require("../constants/httpStatus");

const errorMiddleware = (err, req, res, next) => {
  const statusCode = err.statusCode || httpStatus.INTERNAL_SERVER_ERROR;

  const message =
    err.message || "Internal server error";

  const errors = err.errors || [];

  return res.status(statusCode).json({
    success: false,
    message,
    errors,
  });
};

module.exports = errorMiddleware;