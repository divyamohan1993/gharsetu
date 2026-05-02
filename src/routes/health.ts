import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  // Cloud Run's Knative queue-proxy reserves /healthz on the public URL,
  // so we expose both the canonical k8s path (works via Docker loopback HEALTHCHECK)
  // and an /api/* alias that always reaches the app from the outside.
  const liveness = async () => ({ ok: true, ts: Date.now() });

  app.get("/healthz", liveness);
  app.get("/api/healthz", liveness);

  const readiness = async (
    _req: import("fastify").FastifyRequest,
    reply: import("fastify").FastifyReply,
  ) => {
    try {
      const row = db.prepare(`SELECT 1 AS ok`).get() as { ok: number } | undefined;
      if (!row || row.ok !== 1) {
        reply.code(503);
        return { ok: false, reason: "db_unhealthy" };
      }
      return { ok: true, ts: Date.now() };
    } catch (err) {
      reply.code(503);
      return { ok: false, reason: (err as Error).message };
    }
  };

  app.get("/readyz", readiness);
  app.get("/api/readyz", readiness);
}
