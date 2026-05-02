import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/healthz", async (_req, reply) => {
    return reply.send({ ok: true, ts: Date.now() });
  });

  app.get("/readyz", async (_req, reply) => {
    try {
      const row = db.prepare(`SELECT 1 AS ok`).get() as { ok: number } | undefined;
      if (!row || row.ok !== 1) {
        reply.code(503).send({ ok: false, reason: "db_unhealthy" });
        return reply;
      }
      return reply.send({ ok: true, ts: Date.now() });
    } catch (err) {
      reply.code(503).send({ ok: false, reason: (err as Error).message });
      return reply;
    }
  });
}
