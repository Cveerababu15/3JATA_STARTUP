const env = require("../config/env");

const requestLogger = (req, res, next) => {
  if (env.isTest) {
    return next();
  }

  const startTime = Date.now();

  res.on("finish", () => {
    const durationMs = Date.now() - startTime;
    // Log path without query string so verification/reset tokens in query params never hit logs
    const safePath = req.originalUrl.split("?")[0];
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        requestId: req.id || null,
        method: req.method,
        path: safePath,
        statusCode: res.statusCode,
        durationMs,
      })
    );
  });

  next();
};

module.exports = requestLogger;
