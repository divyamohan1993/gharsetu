import type { FastifyInstance } from "fastify";
import {
  audit,
  db,
  newId,
  now,
  type Booking,
  type Listing,
  type RenterRecord,
  type User,
} from "../db/index.js";
import { requireAuth } from "../auth/middleware.js";
import { buildLocals, setFlash } from "../lib/render.js";
import { detectLang, makeT } from "../i18n.js";

type ListingWithImage = Listing & { primary_image: string | null };
type BookingWithExtras = Booking & {
  listing_title: string;
  student_name: string;
  student_email: string;
};
type RenterWithExtras = RenterRecord & {
  listing_title: string;
  student_name: string;
  student_email: string;
};

export async function registerOwnerRoutes(app: FastifyInstance): Promise<void> {
  app.get("/owner/dashboard", { preHandler: requireAuth(["owner"]) }, async (req, reply) => {
    const user = req.user!;
    const t = makeT(detectLang(req));
    const listings = db
      .prepare(
        `SELECT l.*, (
            SELECT url FROM listing_images li WHERE li.listing_id = l.id ORDER BY position ASC LIMIT 1
          ) AS primary_image
          FROM listings l
          WHERE l.owner_id = ? AND l.status != 'removed'
          ORDER BY l.created_at DESC`,
      )
      .all(user.id) as ListingWithImage[];
    const bookings = db
      .prepare(
        `SELECT b.*, l.title AS listing_title, u.full_name AS student_name, u.email AS student_email
           FROM bookings b
           JOIN listings l ON l.id = b.listing_id
           JOIN users u ON u.id = b.student_id
           WHERE b.owner_id = ?
           ORDER BY b.created_at DESC LIMIT 100`,
      )
      .all(user.id) as BookingWithExtras[];
    const renters = db
      .prepare(
        `SELECT r.*, l.title AS listing_title, u.full_name AS student_name, u.email AS student_email
           FROM renter_records r
           JOIN listings l ON l.id = r.listing_id
           JOIN users u ON u.id = r.student_id
           WHERE l.owner_id = ?
           ORDER BY r.active DESC, r.created_at DESC LIMIT 100`,
      )
      .all(user.id) as RenterWithExtras[];
    return reply.view(
      "owner-dashboard",
      buildLocals(
        req,
        reply,
        { title: t("owner.h.dashboard") },
        { listings, bookings, renters },
      ),
    );
  });

  app.post<{ Params: { lid: string }; Body: { student_id?: string; student_email?: string } }>(
    "/owner/listings/:lid/renters",
    { preHandler: requireAuth(["owner"]) },
    async (req, reply) => {
      const user = req.user!;
      const t = makeT(detectLang(req));
      const listing = db
        .prepare(`SELECT * FROM listings WHERE id = ?`)
        .get(req.params.lid) as Listing | undefined;
      if (!listing || listing.owner_id !== user.id) {
        reply.code(403).send({ error: { code: "FORBIDDEN", message: "Not your listing" } });
        return reply;
      }
      let student: User | undefined;
      if (req.body?.student_id) {
        student = db
          .prepare(`SELECT * FROM users WHERE id = ? AND role = 'student'`)
          .get(req.body.student_id) as User | undefined;
      } else if (req.body?.student_email) {
        student = db
          .prepare(`SELECT * FROM users WHERE email = ? AND role = 'student'`)
          .get(req.body.student_email.trim().toLowerCase()) as User | undefined;
      }
      if (!student) {
        setFlash(reply, "err", "Student not found.");
        return reply.redirect("/owner/dashboard");
      }
      const ts = now();
      const existing = db
        .prepare(`SELECT id FROM renter_records WHERE listing_id = ? AND student_id = ?`)
        .get(listing.id, student.id) as { id: string } | undefined;
      let rid: string;
      if (existing) {
        rid = existing.id;
        db.prepare(
          `UPDATE renter_records SET active=1, ended_at=NULL, source='owner_marked' WHERE id=?`,
        ).run(rid);
      } else {
        rid = newId();
        db.prepare(
          `INSERT INTO renter_records (id, listing_id, student_id, source, active, started_at, ended_at, created_at)
           VALUES (?, ?, ?, 'owner_marked', 1, ?, NULL, ?)`,
        ).run(rid, listing.id, student.id, ts, ts);
      }
      audit({
        actorId: user.id,
        action: "renter.mark",
        entity: "renter_records",
        entityId: rid,
        ip: req.ip,
        ua: req.headers["user-agent"] ?? null,
        payload: { listing_id: listing.id, student_id: student.id },
      });
      setFlash(reply, "ok", t("owner.btn.mark_renter"));
      return reply.redirect("/owner/dashboard");
    },
  );

  app.post<{ Params: { lid: string; sid: string } }>(
    "/owner/listings/:lid/renters/:sid/end",
    { preHandler: requireAuth(["owner"]) },
    async (req, reply) => {
      const user = req.user!;
      const t = makeT(detectLang(req));
      const listing = db
        .prepare(`SELECT * FROM listings WHERE id = ?`)
        .get(req.params.lid) as Listing | undefined;
      if (!listing || listing.owner_id !== user.id) {
        reply.code(403).send({ error: { code: "FORBIDDEN", message: "Not your listing" } });
        return reply;
      }
      const rec = db
        .prepare(`SELECT * FROM renter_records WHERE listing_id = ? AND student_id = ?`)
        .get(listing.id, req.params.sid) as RenterRecord | undefined;
      if (!rec) {
        setFlash(reply, "err", "Renter record not found.");
        return reply.redirect("/owner/dashboard");
      }
      const ts = now();
      db.prepare(`UPDATE renter_records SET active=0, ended_at=? WHERE id=?`).run(ts, rec.id);
      audit({
        actorId: user.id,
        action: "renter.end",
        entity: "renter_records",
        entityId: rec.id,
        ip: req.ip,
        ua: req.headers["user-agent"] ?? null,
        payload: { listing_id: listing.id, student_id: req.params.sid },
      });
      setFlash(reply, "ok", t("owner.btn.unmark_renter"));
      return reply.redirect("/owner/dashboard");
    },
  );
}
