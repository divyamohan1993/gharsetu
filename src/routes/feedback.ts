import type { FastifyInstance } from "fastify";
import { audit, db, newId, now, type Listing } from "../db/index.js";
import { requireAuth } from "../auth/middleware.js";
import { feedbackSchema } from "../lib/validate.js";
import { setFlash } from "../lib/render.js";
import { detectLang, makeT } from "../i18n.js";

export async function registerFeedbackRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
    "/listings/:id/feedback",
    { preHandler: requireAuth() },
    async (req, reply) => {
      const user = req.user!;
      const t = makeT(detectLang(req));
      const listing = db
        .prepare(`SELECT id FROM listings WHERE id = ? AND status != 'removed'`)
        .get(req.params.id) as Pick<Listing, "id"> | undefined;
      if (!listing) {
        reply.code(404).send({ error: { code: "NOT_FOUND", message: "Listing not found" } });
        return reply;
      }
      const parsed = feedbackSchema.safeParse(req.body);
      if (!parsed.success) {
        reply.code(400).send({
          error: {
            code: "BAD_INPUT",
            message: "Invalid feedback",
            details: { issues: parsed.error.issues.map((i) => ({ path: i.path, msg: i.message })) },
          },
        });
        return reply;
      }
      const data = parsed.data;
      const renterRow = db
        .prepare(
          `SELECT 1 FROM renter_records WHERE listing_id = ? AND student_id = ? AND active = 1 LIMIT 1`,
        )
        .get(listing.id, user.id) as { 1: number } | undefined;
      const paymentRow = db
        .prepare(
          `SELECT 1 FROM payments WHERE listing_id = ? AND payer_id = ? AND status = 'captured' LIMIT 1`,
        )
        .get(listing.id, user.id) as { 1: number } | undefined;
      const verified = renterRow || paymentRow ? 1 : 0;
      const id = newId();
      db.prepare(
        `INSERT INTO feedback (id, listing_id, author_id, rating, body, is_verified_renter, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(id, listing.id, user.id, data.rating, data.body, verified, now());
      audit({
        actorId: user.id,
        action: "feedback.create",
        entity: "feedback",
        entityId: id,
        ip: req.ip,
        ua: req.headers["user-agent"] ?? null,
        payload: { listing_id: listing.id, rating: data.rating, verified },
      });
      setFlash(
        reply,
        "ok",
        verified ? t("feedback.note.verified") : t("feedback.note.outsider"),
      );
      return reply.redirect(`/listings/${listing.id}#feedback`);
    },
  );
}
