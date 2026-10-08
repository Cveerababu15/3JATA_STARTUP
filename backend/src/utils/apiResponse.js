const apiResponse = {
    success: (res, message, data = null, statusCode = 200) => {
      return res.status(statusCode).json({
        success: true,
        message,
        data,
      });
    },
  
    error: (res, message, errors = [], statusCode = 500) => {
      return res.status(statusCode).json({
        success: false,
        message,
        errors,
      });
    },
  };
  
  module.exports = apiResponse;