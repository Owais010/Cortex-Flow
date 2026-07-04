"use strict";

const config = require("../config");

function errorHandler(err, req, res, next) {
  console.error("Unhandled error:", err);

  const status = err.status || 500;
  const payload = {
    success: false,
    error: err.message || "Server error",
    code: err.code || "SERVER_ERROR",
  };

  if (config.nodeEnv === "development" && err.stack) {
    payload.stack = err.stack;
  }

  res.status(status).json(payload);
}

module.exports = errorHandler;
