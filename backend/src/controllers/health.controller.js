const apiResponse = require("../utils/apiResponse");
const httpStatus = require("../constants/httpStatus");

const getHealth = async (req, res) => {
  return apiResponse.success(
    res,
    "Server is healthy",
    {
      database: "connected",
    },
    httpStatus.OK
  );
};

module.exports = {
  getHealth,
};