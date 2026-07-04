"use strict";

function requestLogger(req, res, next) {
  const startedAt = Date.now();

  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    const message = `${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms`;
    console.log(message);
  });

  next();
}

module.exports = requestLogger;
