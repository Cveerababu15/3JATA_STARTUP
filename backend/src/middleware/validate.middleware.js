const { validationResult } = require("express-validator");
const httpStatus = require("../constants/httpStatus");
const messages = require("../constants/messages");
const apiResponse = require("../utils/apiResponse");

const validate = (req, res, next) => {
  const result = validationResult(req);

  if (!result.isEmpty()) {
    const formattedErrors = result.array({ onlyFirstError: true }).map((err) => ({
      field: err.path || err.param || "request",
      message: err.msg,
    }));

    return apiResponse.error(
      res,
      messages.VALIDATION_FAILED,
      formattedErrors,
      httpStatus.BAD_REQUEST
    );
  }

  return next();
};

module.exports = validate;
