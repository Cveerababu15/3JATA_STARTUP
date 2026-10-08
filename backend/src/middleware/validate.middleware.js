const {validationResult}=require("express-validator")
const httpStatus=require("../constants/httpStatus")
const validate = (req, res, next) => {
    const errors = validationResult(req);
  
    if (!errors.isEmpty()) {
      return res.status(httpStatus.BAD_REQUEST).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }
  
    next();
  };
  
  module.exports = validate;