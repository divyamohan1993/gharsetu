import type { FastifyInstance } from "fastify";
import { audit, db, newId, now, type Booking, type Listing } from "../db/index.js";
import { requireAuth } from "../auth/middleware.js";
import { bookingSchema } from "../lib/validate.js";
import { setFlash } from "../lib/render.js";
import { detectLang, makeT } from "../i18n.js";

export async function registerBookingsRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: Record<string, unknown> }>(
    "/bookings",
    { preHandler: requireAuth(["student"]) },
    async (req, reply) => {
      const user = req.user!;
      const t = makeT(detectLang(req));
      const parsed = bookingSchema.safeParse(req.body);
      if (!parsed.success) {
        reply.code(400).send({
          error: {
            code: "BAD_INPUT",
            message: "Invalid booking",
            details: { issues: parsed.error.issues.map((i) => ({ path: i.path, msg: i.message })) },
          },
        });
        return reply;
      }
      const data = parsed.data;
      const listing = db
        .prepare(`SELECT * FROM listings WHERE id = ? AND status = 'active'`)
        .get(data.listing_id) as Listing | undefined;
      if (!listing) {
        reply.code(404).send({ error: { code: "NOT_FOUND", message: "Listing not available" } });
        return reply;
      }
      if (listing.owner_id === user.id) {
        reply.code(400).send({ error: { code: "SELF_BOOKING", message: "Cannot book your own listing" } });
        return reply;
      }
      const id = newId();
      const ts = now();
      db.prepare(
        `INSERT INTO bookings (id, listing_id, student_id, owner_id, type, visit_at, message, status, ondc_order_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NULL, ?, ?)`,
      ).run(
        id,
        listing.id,
        user.id,
        listing.owner_id,
        data.type,
        data.visit_at ?? null,
        data.message ?? null,
        ts,
        ts,
      );
      audit({
        actorId: user.id,
        action: "booking.create",
        entity: "bookings",
        entityId: id,
        ip: req.ip,
        ua: req.headers["user-agent"] ?? null,
        payload: { listing_id: listing.id, owner_id: listing.owner_id, type: data.type },
      });
      audit({
        actorId: null,
        action: "notify.owner_new_booking",
        entity: "bookings",
        entityId: id,
        payload: {
          owner_id: listing.owner_id,
          listing_id: listing.id,
          channel: "in_app",
          message: `New ${data.type} request for ${listing.title}`,
        },
      });
      setFlash(reply, "ok", t("booking.success"));
      return reply.redirect(`/listings/${listing.id}`);
    },
  );

  app.post<{ Params: { id: string }; Body: { decision?: string } }>(
    "/bookings/:id/decision",
    { preHandler: requireAuth(["owner"]) },
    async (req, reply) => {
      const user = req.user!;
      const t = makeT(detectLang(req));
      const decision = (req.body?.decision ?? "").toLowerCase();
      if (decision !== "accept" && decision !== "decline") {
        reply.code(400).send({ error: { code: "BAD_DECISION", message: "decision must be accept|decline" } });
        return reply;
      }
      const booking = db
        .prepare(`SELECT * FROM bookings WHERE id = ?`)
        .get(req.params.id) as Booking | undefined;
      if (!booking) {
        reply.code(404).send({ error: { code: "NOT_FOUND", message: "Booking not found" } });
        return reply;
      }
      if (booking.owner_id !== user.id) {
        reply.code(403).send({ error: { code: "FORBIDDEN", message: "Not your booking" } });
        return reply;
      }
      if (booking.status !== "pending") {
        reply.code(409).send({ error: { code: "ALREADY_DECIDED", message: "Booking already decided" } });
        return reply;
      }
      const newStatus = decision === "accept" ? "accepted" : "declined";
      const ts = now();
      db.prepare(`UPDATE bookings SET status=?, updated_at=? WHERE id=?`).run(newStatus, ts, booking.id);
      audit({
        actorId: user.id,
        action: `booking.${newStatus}`,
        entity: "bookings",
        entityId: booking.id,
        ip: req.ip,
        ua: req.headers["user-agent"] ?? null,
        payload: { listing_id: booking.listing_id, student_id: booking.student_id },
      });
      audit({
        actorId: null,
        action: "notify.student_booking_decision",
        entity: "bookings",
        entityId: booking.id,
        payload: {
          student_id: booking.student_id,
          listing_id: booking.listing_id,
          channel: "in_app",
          decision: newStatus,
        },
      });
      setFlash(
        reply,
        "ok",
        newStatus === "accepted" ? t("booking.status.accepted") : t("booking.status.declined"),
      );
      return reply.redirect("/owner/dashboard");
    },
  );
}
