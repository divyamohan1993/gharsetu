import Fastify, { type FastifyBaseLogger } from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyFormbody from "@fastify/formbody";
import fastifyMultipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import fastifyView from "@fastify/view";
import fastifyCsrf from "@fastify/csrf-protection";
import fastifyRateLimit from "@fastify/rate-limit";
import ejs from "ejs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ulid } from "ulid";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { db, audit } from "./db/index.js";
import { loadUser } from "./auth/middleware.js";
import { detectLang, makeT } from "./i18n.js";
import { buildLocals } from "./lib/render.js";
import { registerHomeRoutes } from "./routes/home.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerSearchRoutes } from "./routes/search.js";
import { registerListingsRoutes } from "./routes/listings.js";
import { registerBookingsRoutes } from "./routes/bookings.js";
import { registerFeedbackRoutes } from "./routes/feedback.js";
import { registerVerificationRoutes } from "./routes/verification.js";
import { registerPaymentsRoutes } from "./routes/payments.js";
import { registerOndcRoutes } from "./routes/ondc.js";
import { registerOwnerRoutes } from "./routes/owner.js";
import { registerStudentRoutes } from "./routes/student.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerHealthRoutes } from "./routes/health.js";
import { runSeed } from "./db/seed.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  const app = Fastify({
    loggerInstance: logger as unknown as FastifyBaseLogger,
    genReqId: () => ulid(),
    trustProxy: true,
    bodyLimit: 10 * 1024 * 1024,
    disableRequestLogging: false,
  });

  await app.register(fastifyCookie, { secret: config.COOKIE_SECRET });
  await app.register(fastifyFormbody);
  await app.register(fastifyMultipart, {
    limits: { fileSize: 8 * 1024 * 1024, files: 6 },
  });
  await app.register(fastifyRateLimit, {
    max: config.RATE_LIMIT.MAX,
    timeWindow: config.RATE_LIMIT.WINDOW_MS,
    allowList: (req) => req.url.startsWith("/healthz") || req.url.startsWith("/readyz"),
  });
  await app.register(fastifyView, {
    engine: { ejs },
    root: join(__dirname, "views"),
    includeViewExtension: true,
    viewExt: "ejs",
    options: { async: false, cache: config.isProd },
  });
  await app.register(fastifyStatic, {
    root: join(__dirname, "public"),
    prefix: "/static/",
    maxAge: config.isProd ? "7d" : "0",
    immutable: false,
    decorateReply: true,
  });
  await app.register(fastifyStatic, {
    root: config.UPLOADS_DIR,
    prefix: "/uploads/",
    maxAge: config.isProd ? "30d" : "0",
    decorateReply: false,
  });
  await app.register(fastifyCsrf, { cookieOpts: { signed: false, sameSite: "lax", path: "/" } });

  app.addHook("onRequest", async (req) => {
    await loadUser(req);
  });

  app.addHook("onResponse", async (req, reply) => {
    audit({
      actorId: req.user?.id ?? null,
      action: "http",
      entity: "request",
      entityId: req.id as string,
      ip: req.ip,
      ua: req.headers["user-agent"] ?? null,
      payload: {
        method: req.method,
        url: req.url,
        status: reply.statusCode,
        ms: Math.round(reply.elapsedTime),
      },
    });
  });

  app.setErrorHandler(async (err: Error & { statusCode?: number; code?: string }, req, reply) => {
    const reqId = req.id as string;
    req.log.error({ err, reqId }, "request.error");
    if (err.statusCode === 429) {
      reply.code(429).send({
        error: { code: "RATE_LIMITED", message: "Too many requests. Slow down." },
      });
      return;
    }
    if ((err as { code?: string }).code === "FST_CSRF_INVALID_TOKEN" || (err as { code?: string }).code === "FST_CSRF_MISSING_SECRET") {
      const lang = detectLang(req);
      const t = makeT(lang);
      reply.code(403).type("text/html").send(
        await reply.view("error", buildLocals(req, reply, { title: t("error.csrf") }, { errorTitle: t("error.csrf"), errorBody: t("error.csrf"), code: 403 })),
      );
      return;
    }
    const accept = req.headers.accept ?? "";
    if (accept.includes("text/html")) {
      const lang = detectLang(req);
      const t = makeT(lang);
      reply.code(500).type("text/html").send(
        await reply.view("error", buildLocals(req, reply, { title: t("error.500.title") }, { errorTitle: t("error.500.title"), errorBody: t("error.500.body"), code: 500, reqId })),
      );
      return;
    }
    reply.code(500).send({
      error: { code: "INTERNAL", message: "Internal server error", details: { reqId } },
    });
  });

  app.setNotFoundHandler(async (req, reply) => {
    const accept = req.headers.accept ?? "";
    if (accept.includes("text/html")) {
      const lang = detectLang(req);
      const t = makeT(lang);
      reply.code(404).type("text/html").send(
        await reply.view("error", buildLocals(req, reply, { title: t("error.404.title") }, { errorTitle: t("error.404.title"), errorBody: t("error.404.body"), code: 404 })),
      );
      return;
    }
    reply.code(404).send({
      error: { code: "NOT_FOUND", message: "Not found" },
    });
  });

  await registerHealthRoutes(app);
  await registerHomeRoutes(app);
  await registerAuthRoutes(app);
  await registerSearchRoutes(app);
  await registerListingsRoutes(app);
  await registerBookingsRoutes(app);
  await registerFeedbackRoutes(app);
  await registerVerificationRoutes(app);
  await registerPaymentsRoutes(app);
  await registerOndcRoutes(app);
  await registerOwnerRoutes(app);
  await registerStudentRoutes(app);
  await registerAdminRoutes(app);

  if (config.SEED_ON_START) {
    const userCount = (db.prepare(`SELECT COUNT(*) as c FROM users`).get() as { c: number }).c;
    if (userCount === 0) {
      await runSeed();
      logger.info({ msg: "seed.complete" });
    }
  }

  const close = async (): Promise<void> => {
    logger.info({ msg: "shutdown.begin" });
    await app.close();
    db.close();
    logger.info({ msg: "shutdown.done" });
    process.exit(0);
  };
  process.on("SIGTERM", close);
  process.on("SIGINT", close);

  await app.listen({ port: config.PORT, host: config.HOST });
  logger.info({ msg: "server.listening", port: config.PORT, host: config.HOST });
}

main().catch((err) => {
  logger.fatal({ err }, "server.fatal");
  process.exit(1);
});
