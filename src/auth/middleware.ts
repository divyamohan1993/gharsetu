import type { FastifyReply, FastifyRequest } from "fastify";
import { db, type User } from "../db/index.js";
import { COOKIE_NAME, verifyToken } from "./jwt.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: User;
  }
}

export async function loadUser(req: FastifyRequest): Promise<User | undefined> {
  if (req.user) return req.user;
  const raw = req.cookies?.[COOKIE_NAME];
  if (!raw) return undefined;
  const payload = verifyToken(raw);
  if (!payload) return undefined;
  const user = db
    .prepare(`SELECT * FROM users WHERE id = ?`)
    .get(payload.sub) as User | undefined;
  if (user) req.user = user;
  return user;
}

export function requireAuth(roles?: Array<User["role"]>) {
  return async function (req: FastifyRequest, reply: FastifyReply) {
    const user = await loadUser(req);
    if (!user) {
      const wantsHtml = (req.headers.accept ?? "").includes("text/html");
      if (wantsHtml) {
        reply.redirect(`/login?next=${encodeURIComponent(req.url)}`);
        return reply;
      }
      reply.code(401).send({
        error: { code: "UNAUTHENTICATED", message: "Login required" },
      });
      return reply;
    }
    if (roles && !roles.includes(user.role)) {
      reply.code(403).send({
        error: { code: "FORBIDDEN", message: "Insufficient permissions" },
      });
      return reply;
    }
  };
}
