import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { requireAuth } from "../auth/middleware.js";
import { buildLocals } from "../lib/render.js";
import { detectLang, makeT } from "../i18n.js";

type AuditRow = {
  id: string;
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  ip: string | null;
  ua: string | null;
  payload: string | null;
  created_at: number;
};

type Counts = {
  users: number;
  listings: number;
  bookings: number;
  payments: number;
  feedback: number;
  active_renters: number;
  ondc_messages: number;
};

function clampLimit(raw: unknown, def: number, max: number): number {
  const n = Number.parseInt(typeof raw === "string" ? raw : "", 10);
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(n, max);
}

function getCounts(): Counts {
  const one = (sql: string): number =>
    (db.prepare(sql).get() as { c: number }).c;
  return {
    users: one(`SELECT COUNT(*) AS c FROM users`),
    listings: one(`SELECT COUNT(*) AS c FROM listings WHERE status != 'removed'`),
    bookings: one(`SELECT COUNT(*) AS c FROM bookings`),
    payments: one(`SELECT COUNT(*) AS c FROM payments`),
    feedback: one(`SELECT COUNT(*) AS c FROM feedback`),
    active_renters: one(`SELECT COUNT(*) AS c FROM renter_records WHERE active = 1`),
    ondc_messages: one(`SELECT COUNT(*) AS c FROM ondc_messages`),
  };
}

export async function registerAdminRoutes(app: FastifyInstance): Promise<void> {
  app.get("/admin", { preHandler: requireAuth(["admin"]) }, async (req, reply) => {
    const t = makeT(detectLang(req));
    const limit = clampLimit((req.query as { limit?: string }).limit, 200, 1000);
    const audit = db
      .prepare(`SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?`)
      .all(limit) as AuditRow[];
    const counts = getCounts();
    return reply.view(
      "admin",
      buildLocals(
        req,
        reply,
        { title: t("admin.h.title") },
        { audit, counts, limit },
      ),
    );
  });

  app.get("/admin/audit.json", { preHandler: requireAuth(["admin"]) }, async (req, reply) => {
    const limit = clampLimit((req.query as { limit?: string }).limit, 200, 2000);
    const since = Number.parseInt(((req.query as { since?: string }).since ?? "0"), 10);
    const rows = Number.isFinite(since) && since > 0
      ? (db.prepare(`SELECT * FROM audit_log WHERE created_at > ? ORDER BY created_at DESC LIMIT ?`).all(since, limit) as AuditRow[])
      : (db.prepare(`SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?`).all(limit) as AuditRow[]);
    return reply.send({ data: rows, counts: getCounts() });
  });

  app.get("/admin/audit/stream", { preHandler: requireAuth(["admin"]) }, async (req, reply) => {
    reply.raw.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      "connection": "keep-alive",
      "x-accel-buffering": "no",
    });
    reply.raw.write(`retry: 5000\n\n`);

    let lastTs = Date.now() - 60_000;
    let closed = false;

    const tick = (): void => {
      if (closed) return;
      const rows = db
        .prepare(`SELECT * FROM audit_log WHERE created_at > ? ORDER BY created_at ASC LIMIT 200`)
        .all(lastTs) as AuditRow[];
      for (const r of rows) {
        if (r.created_at > lastTs) lastTs = r.created_at;
        reply.raw.write(`event: audit\ndata: ${JSON.stringify(r)}\n\n`);
      }
      reply.raw.write(`event: ping\ndata: ${Date.now()}\n\n`);
    };

    const interval = setInterval(tick, 2000);
    tick();

    const cleanup = (): void => {
      if (closed) return;
      closed = true;
      clearInterval(interval);
      try { reply.raw.end(); } catch { /* ignore */ }
    };
    req.raw.on("close", cleanup);
    req.raw.on("error", cleanup);
    return reply;
  });
}
