const httpStatus=require("../constants/httpStatus")
const notFoundMiddleware = (req, res) => {
    return res.status(httpStatus.NOT_FOUND).json({
      success: false,
      message: `Route not found: ${req.method} ${req.originalUrl}`,
      errors: [],
    });
  };
  
  module.exports = notFoundMiddleware;