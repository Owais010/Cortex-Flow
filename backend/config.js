"use strict";

require("dotenv").config();

const required = ["SUPABASE_URL", "SUPABASE_SERVICE_KEY", "ENCRYPTION_KEY"];
const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  throw new Error(`Missing required env vars: ${missing.join(", ")}`);
}

const config = Object.freeze({
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_SERVICE_KEY,
  encryptionKey: process.env.ENCRYPTION_KEY,
  port: process.env.PORT || 8000,
  dailyCapUSD: parseFloat(process.env.DAILY_CAP_USD || "5.0"),
  nodeEnv: process.env.NODE_ENV || "development",
});

console.log("✅ Config validated");

module.exports = config;
