const apiResponse = require("../utils/apiResponse");
const httpStatus = require("../constants/httpStatus");
const { getDatabaseState, isDatabaseConnected } = require("../config/database");

const getHealth = async (req, res) => {
  return apiResponse.success(
    res,
    "Server is healthy",
    {
      status: "ok",
      database: getDatabaseState(),
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    },
    httpStatus.OK
  );
};

const getReadiness = async (req, res) => {
  const dbReady = isDatabaseConnected();
  const payload = {
    status: dbReady ? "ready" : "not_ready",
    database: getDatabaseState(),
    timestamp: new Date().toISOString(),
  };

  if (!dbReady) {
    return res.status(httpStatus.SERVICE_UNAVAILABLE).json({
      success: false,
      message: "Database is not connected",
      errors: [],
      data: payload,
    });
  }

  return apiResponse.success(res, "Server is ready", payload, httpStatus.OK);
};

module.exports = {
  getHealth,
  getReadiness,
};
