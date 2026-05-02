import jwt from "jsonwebtoken";
import { ulid } from "ulid";
import { config } from "../config.js";
import { db } from "../db/index.js";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export type JwtPayload = {
  sub: string;
  role: "student" | "owner" | "admin";
  jti: string;
};

export function issueToken(userId: string, role: JwtPayload["role"]): string {
  const jti = ulid();
  const exp = Math.floor((Date.now() + SEVEN_DAYS_MS) / 1000);
  const token = jwt.sign(
    { sub: userId, role, jti },
    config.JWT_SECRET,
    { algorithm: "HS256", expiresIn: "7d" },
  );
  db.prepare(
    `INSERT INTO sessions (jti, user_id, revoked, created_at, expires_at) VALUES (?, ?, 0, ?, ?)`,
  ).run(jti, userId, Date.now(), exp * 1000);
  return token;
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET, {
      algorithms: ["HS256"],
    }) as JwtPayload;
    if (!decoded.sub || !decoded.jti || !decoded.role) return null;
    const session = db
      .prepare(`SELECT revoked FROM sessions WHERE jti = ?`)
      .get(decoded.jti) as { revoked: number } | undefined;
    if (!session || session.revoked) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function revokeToken(jti: string): void {
  db.prepare(`UPDATE sessions SET revoked = 1 WHERE jti = ?`).run(jti);
}

export const COOKIE_NAME = "gs_session";
export const COOKIE_MAX_AGE_MS = SEVEN_DAYS_MS;
