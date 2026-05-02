import type { FastifyInstance } from "fastify";
import { db, audit, newId, now, type User } from "../db/index.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { COOKIE_NAME, COOKIE_MAX_AGE_MS, issueToken, revokeToken, verifyToken } from "../auth/jwt.js";
import { config } from "../config.js";
import { signupSchema, loginSchema } from "../lib/validate.js";
import { buildLocals, setFlash } from "../lib/render.js";
import { detectLang, makeT } from "../i18n.js";

function safeNext(input: unknown): string {
  if (typeof input !== "string") return "/";
  if (!input.startsWith("/") || input.startsWith("//")) return "/";
  return input;
}

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { next?: string } }>("/signup", async (req, reply) => {
    const t = makeT(detectLang(req));
    return reply.view(
      "signup",
      buildLocals(
        req,
        reply,
        { title: t("auth.h.signup") },
        { next: safeNext(req.query.next), values: {}, fieldErrors: {} },
      ),
    );
  });

  app.post<{ Body: Record<string, unknown>; Querystring: { next?: string } }>(
    "/signup",
    async (req, reply) => {
      const parsed = signupSchema.safeParse(req.body);
      const t = makeT(detectLang(req));
      const next = safeNext(req.query.next ?? (req.body as { next?: string }).next);
      if (!parsed.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          const k = issue.path.join(".") || "_";
          fieldErrors[k] = issue.message;
        }
        reply.code(400);
        return reply.view(
          "signup",
          buildLocals(
            req,
            reply,
            { title: t("auth.h.signup") },
            { next, values: req.body ?? {}, fieldErrors },
          ),
        );
      }
      const data = parsed.data;
      const existing = db
        .prepare(`SELECT id FROM users WHERE email = ?`)
        .get(data.email) as { id: string } | undefined;
      if (existing) {
        reply.code(409);
        return reply.view(
          "signup",
          buildLocals(
            req,
            reply,
            { title: t("auth.h.signup") },
            {
              next,
              values: req.body ?? {},
              fieldErrors: { email: t("auth.error.exists") },
            },
          ),
        );
      }
      const id = newId();
      const ts = now();
      const hash = await hashPassword(data.password);
      db.prepare(
        `INSERT INTO users (id, email, phone, password_hash, full_name, role, preferred_lang, kyc_verified, kyc_method, kyc_payload, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL, ?, ?)`,
      ).run(
        id,
        data.email,
        data.phone ?? null,
        hash,
        data.full_name,
        data.role,
        data.preferred_lang ?? "en",
        ts,
        ts,
      );
      audit({
        actorId: id,
        action: "user.signup",
        entity: "users",
        entityId: id,
        ip: req.ip,
        ua: req.headers["user-agent"] ?? null,
        payload: { email: data.email, role: data.role },
      });
      const token = issueToken(id, data.role);
      reply.setCookie(COOKIE_NAME, token, {
        path: "/",
        httpOnly: true,
        secure: config.COOKIE_SECURE,
        sameSite: "lax",
        maxAge: Math.floor(COOKIE_MAX_AGE_MS / 1000),
      });
      setFlash(reply, "ok", t("verify.intro"));
      return reply.redirect(next);
    },
  );

  app.get<{ Querystring: { next?: string } }>("/login", async (req, reply) => {
    const t = makeT(detectLang(req));
    return reply.view(
      "login",
      buildLocals(
        req,
        reply,
        { title: t("auth.h.login") },
        { next: safeNext(req.query.next), values: {}, fieldErrors: {} },
      ),
    );
  });

  app.post<{ Body: Record<string, unknown>; Querystring: { next?: string } }>(
    "/login",
    async (req, reply) => {
      const parsed = loginSchema.safeParse(req.body);
      const t = makeT(detectLang(req));
      const next = safeNext(req.query.next ?? (req.body as { next?: string }).next);
      if (!parsed.success) {
        reply.code(400);
        return reply.view(
          "login",
          buildLocals(
            req,
            reply,
            { title: t("auth.h.login") },
            {
              next,
              values: req.body ?? {},
              fieldErrors: { _: t("auth.error.invalid") },
            },
          ),
        );
      }
      const data = parsed.data;
      const user = db
        .prepare(`SELECT * FROM users WHERE email = ?`)
        .get(data.email) as User | undefined;
      const ok = user
        ? await verifyPassword(data.password, user.password_hash)
        : false;
      if (!user || !ok) {
        audit({
          actorId: null,
          action: "user.login_failed",
          entity: "users",
          entityId: null,
          ip: req.ip,
          ua: req.headers["user-agent"] ?? null,
          payload: { email: data.email },
        });
        reply.code(401);
        return reply.view(
          "login",
          buildLocals(
            req,
            reply,
            { title: t("auth.h.login") },
            {
              next,
              values: { email: data.email },
              fieldErrors: { _: t("auth.error.invalid") },
            },
          ),
        );
      }
      const token = issueToken(user.id, user.role);
      reply.setCookie(COOKIE_NAME, token, {
        path: "/",
        httpOnly: true,
        secure: config.COOKIE_SECURE,
        sameSite: "lax",
        maxAge: Math.floor(COOKIE_MAX_AGE_MS / 1000),
      });
      audit({
        actorId: user.id,
        action: "user.login",
        entity: "users",
        entityId: user.id,
        ip: req.ip,
        ua: req.headers["user-agent"] ?? null,
      });
      setFlash(reply, "ok", t("auth.btn.login"));
      return reply.redirect(next);
    },
  );

  app.post("/logout", async (req, reply) => {
    const raw = req.cookies?.[COOKIE_NAME];
    if (raw) {
      const payload = verifyToken(raw);
      if (payload) {
        revokeToken(payload.jti);
        audit({
          actorId: payload.sub,
          action: "user.logout",
          entity: "users",
          entityId: payload.sub,
          ip: req.ip,
          ua: req.headers["user-agent"] ?? null,
        });
      }
    }
    reply.clearCookie(COOKIE_NAME, { path: "/" });
    return reply.redirect("/");
  });
}
