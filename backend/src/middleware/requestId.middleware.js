const crypto = require("crypto");

const SAFE_REQUEST_ID = /^[a-zA-Z0-9_-]{8,64}$/;

const requestIdMiddleware = (req, res, next) => {
  const incomingId = req.get("X-Request-Id");
  const requestId =
    incomingId && SAFE_REQUEST_ID.test(incomingId) ? incomingId : crypto.randomUUID();

  req.id = requestId;
  res.setHeader("X-Request-Id", requestId);
  next();
};

module.exports = requestIdMiddleware;
