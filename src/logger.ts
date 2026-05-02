import pino from "pino";
import { config } from "./config.js";

export const logger = pino({
  level: config.LOG_LEVEL,
  base: {
    service: "gharsetu",
    env: config.NODE_ENV,
    pid: process.pid,
  },
  timestamp: () => `,"ts":${Date.now()}`,
  formatters: {
    level: (label) => ({ level: label }),
  },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      'req.headers["set-cookie"]',
      "*.password",
      "*.password_hash",
      "*.kyc_payload",
      "*.rzp_signature",
    ],
    censor: "[REDACTED]",
  },
});

export type Logger = typeof logger;
