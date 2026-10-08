const requestLogger = (req, res, next) => {
    if (process.env.NODE_ENV !== "development") {
      return next();
    }
  
    const startTime = Date.now();
  
    res.on("finish", () => {
      const duration = Date.now() - startTime;
  
      console.log(
        `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`
      );
    });
  
    next();
  };
  
  module.exports = requestLogger;