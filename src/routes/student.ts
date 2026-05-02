import type { FastifyInstance } from "fastify";
import { db, type Booking, type Feedback, type Payment } from "../db/index.js";
import { requireAuth } from "../auth/middleware.js";
import { buildLocals } from "../lib/render.js";
import { detectLang, makeT } from "../i18n.js";

type BookingRow = Booking & { listing_title: string; listing_city: string };
type PaymentRow = Payment & { listing_title: string };
type FeedbackRow = Feedback & { listing_title: string };

export async function registerStudentRoutes(app: FastifyInstance): Promise<void> {
  app.get("/student/dashboard", { preHandler: requireAuth(["student"]) }, async (req, reply) => {
    const user = req.user!;
    const t = makeT(detectLang(req));
    const bookings = db
      .prepare(
        `SELECT b.*, l.title AS listing_title, l.city AS listing_city
           FROM bookings b
           JOIN listings l ON l.id = b.listing_id
           WHERE b.student_id = ?
           ORDER BY b.created_at DESC LIMIT 100`,
      )
      .all(user.id) as BookingRow[];
    const payments = db
      .prepare(
        `SELECT p.*, l.title AS listing_title
           FROM payments p
           JOIN listings l ON l.id = p.listing_id
           WHERE p.payer_id = ?
           ORDER BY p.created_at DESC LIMIT 100`,
      )
      .all(user.id) as PaymentRow[];
    const myFeedback = db
      .prepare(
        `SELECT f.*, l.title AS listing_title
           FROM feedback f
           JOIN listings l ON l.id = f.listing_id
           WHERE f.author_id = ?
           ORDER BY f.created_at DESC LIMIT 100`,
      )
      .all(user.id) as FeedbackRow[];
    return reply.view(
      "student-dashboard",
      buildLocals(
        req,
        reply,
        { title: t("student.h.dashboard") },
        { bookings, payments, myFeedback },
      ),
    );
  });
}
