const apiResponse = {
  success: (res, message, data = null, statusCode = 200) => {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
    });
  },

  paginated: (res, message, items, pagination, statusCode = 200) => {
    return res.status(statusCode).json({
      success: true,
      message,
      data: {
        items,
        pagination,
      },
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
