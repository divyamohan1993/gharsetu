import { randomBytes } from "node:crypto";

function env(name: string, fallback?: string): string {
  const v = process.env[name];
  if (v !== undefined && v !== "") return v;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required env: ${name}`);
}

function envInt(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number.parseInt(v, 10);
  if (Number.isNaN(n)) throw new Error(`Invalid integer env: ${name}=${v}`);
  return n;
}

function envBool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined) return fallback;
  return v === "1" || v.toLowerCase() === "true";
}

const NODE_ENV = env("NODE_ENV", "production");
const isProd = NODE_ENV === "production";

let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  JWT_SECRET = randomBytes(48).toString("hex");
  // eslint-disable-next-line no-console
  console.warn(
    JSON.stringify({
      level: "warn",
      msg: "JWT_SECRET not provided or too short; generated ephemeral secret. Sessions will not survive restart.",
      ts: Date.now(),
    }),
  );
}

export const config = {
  NODE_ENV,
  isProd,
  PORT: envInt("PORT", 8080),
  HOST: env("HOST", "0.0.0.0"),
  LOG_LEVEL: env("LOG_LEVEL", isProd ? "info" : "debug"),
  DB_PATH: env("DB_PATH", "/tmp/gharsetu.db"),
  UPLOADS_DIR: env("UPLOADS_DIR", "/tmp/uploads"),
  SEED_ON_START: envBool("SEED_ON_START", true),
  JWT_SECRET,
  COOKIE_SECRET: env("COOKIE_SECRET", JWT_SECRET),
  COOKIE_SECURE: envBool("COOKIE_SECURE", isProd),
  ADMIN_EMAIL: env("ADMIN_EMAIL", "admin@gharsetu.local"),
  ADMIN_PASSWORD: env("ADMIN_PASSWORD", "ChangeMe!2026"),
  ONDC: {
    BAP_URI: env("ONDC_BAP_URI", "https://gharsetu.local/ondc/v1"),
    BAP_ID: env("ONDC_BAP_ID", "gharsetu.local"),
    BPP_URI: env("ONDC_BPP_URI", "https://gharsetu.local/ondc/v1"),
    BPP_ID: env("ONDC_BPP_ID", "gharsetu.local"),
    DOMAIN: env("ONDC_DOMAIN", "ONDC:RET11"),
    COUNTRY: env("ONDC_COUNTRY", "IND"),
    CITY: env("ONDC_CITY", "std:0792"),
  },
  RZP: {
    KEY_ID: env("RZP_KEY_ID", "rzp_test_simulated"),
    KEY_SECRET: env("RZP_KEY_SECRET", "simulated_secret_aaaaaaaaaaaaaa"),
    WEBHOOK_SECRET: env("RZP_WEBHOOK_SECRET", "simulated_webhook_secret"),
  },
  DIGILOCKER: {
    CLIENT_ID: env("DIGILOCKER_CLIENT_ID", "simulated_dl_client"),
    CLIENT_SECRET: env("DIGILOCKER_CLIENT_SECRET", "simulated_dl_secret"),
    REDIRECT_URI: env(
      "DIGILOCKER_REDIRECT_URI",
      "http://localhost:8080/verify/digilocker/callback",
    ),
    AUTH_URL: env(
      "DIGILOCKER_AUTH_URL",
      "https://api.digitallocker.gov.in/public/oauth2/1/authorize",
    ),
    TOKEN_URL: env(
      "DIGILOCKER_TOKEN_URL",
      "https://api.digitallocker.gov.in/public/oauth2/1/token",
    ),
  },
  RATE_LIMIT: {
    MAX: envInt("RATE_LIMIT_MAX", 200),
    WINDOW_MS: envInt("RATE_LIMIT_WINDOW_MS", 60_000),
  },
  DEFAULT_CITY: env("DEFAULT_CITY", "Solan"),
  DEFAULT_LANG: env("DEFAULT_LANG", "en"),
} as const;

export type AppConfig = typeof config;
