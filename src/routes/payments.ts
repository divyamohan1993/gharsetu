// ===== REAL PROD CODE (replace stub on launch) =====
//
// Razorpay Orders + Webhook — production wiring:
//
//   import Razorpay from "razorpay";
//   const rzp = new Razorpay({ key_id: config.RZP.KEY_ID, key_secret: config.RZP.KEY_SECRET });
//
//   // POST /pay/order
//   const order = await rzp.orders.create({
//     amount: amountPaise,                  // INR paise
//     currency: "INR",
//     receipt: `bk_${booking.id}`,
//     payment_capture: 1,
//     notes: { listing_id, payer_id, payee_id, for_month },
//   });
//   // Persist order.id, return { order_id: order.id, key_id: KEY_ID, amount, currency } to client.
//
//   // POST /pay/webhook
//   //   Razorpay sets header: x-razorpay-signature = HMAC_SHA256(rawBody, RZP.WEBHOOK_SECRET)
//   //   Real payload shape (event=payment.captured):
//   //   { entity:"event", event:"payment.captured", contains:["payment"],
//   //     payload:{ payment:{ entity:{ id:"pay_...", order_id:"order_...", amount, currency, status:"captured", method, ... } } } }
//   const expected = crypto.createHmac("sha256", config.RZP.WEBHOOK_SECRET).update(rawBody).digest("hex");
//   if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return reply.code(400).send();
//
// =====================================================

import type { FastifyInstance, FastifyRequest } from "fastify";
import crypto from "node:crypto";
import {
  audit,
  db,
  newId,
  now,
  type Booking,
  type Listing,
  type Payment,
} from "../db/index.js";
import { requireAuth } from "../auth/middleware.js";
import { buildLocals, setFlash } from "../lib/render.js";
import { detectLang, makeT } from "../i18n.js";
import { config } from "../config.js";

type CreateOrderBody = {
  booking_id?: string;
  listing_id?: string;
  amount?: number;
  for_month?: string;
};

type WebhookPayload = {
  event?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        amount?: number;
        currency?: string;
        status?: string;
      };
    };
  };
};

function rawBodyOf(req: FastifyRequest): string {
  if (typeof req.body === "string") return req.body;
  return JSON.stringify(req.body ?? {});
}

export async function registerPaymentsRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { bookingId: string } }>(
    "/pay/:bookingId",
    { preHandler: requireAuth(["student"]) },
    async (req, reply) => {
      const user = req.user!;
      const t = makeT(detectLang(req));
      const booking = db
        .prepare(`SELECT * FROM bookings WHERE id = ?`)
        .get(req.params.bookingId) as Booking | undefined;
      if (!booking || booking.student_id !== user.id) {
        reply.code(404);
        return reply.view(
          "error",
          buildLocals(
            req,
            reply,
            { title: t("error.404.title") },
            { errorTitle: t("error.404.title"), errorBody: t("error.404.body"), code: 404 },
          ),
        );
      }
      const listing = db
        .prepare(`SELECT * FROM listings WHERE id = ?`)
        .get(booking.listing_id) as Listing | undefined;
      if (!listing) {
        reply.code(404);
        return reply.view(
          "error",
          buildLocals(
            req,
            reply,
            { title: t("error.404.title") },
            { errorTitle: t("error.404.title"), errorBody: t("error.404.body"), code: 404 },
          ),
        );
      }
      return reply.view(
        "pay",
        buildLocals(
          req,
          reply,
          { title: t("pay.h.title") },
          {
            booking,
            listing,
            keyId: config.RZP.KEY_ID,
            amount: listing.rent_monthly,
            currency: "INR",
          },
        ),
      );
    },
  );

  app.post<{ Body: CreateOrderBody }>(
    "/pay/order",
    { preHandler: requireAuth(["student"]) },
    async (req, reply) => {
      const user = req.user!;
      const body = req.body ?? {};
      let listing: Listing | undefined;
      let bookingId: string | null = null;

      if (body.booking_id) {
        const booking = db
          .prepare(`SELECT * FROM bookings WHERE id = ?`)
          .get(body.booking_id) as Booking | undefined;
        if (!booking || booking.student_id !== user.id) {
          reply.code(404).send({ error: { code: "NOT_FOUND", message: "Booking not found" } });
          return reply;
        }
        bookingId = booking.id;
        listing = db
          .prepare(`SELECT * FROM listings WHERE id = ?`)
          .get(booking.listing_id) as Listing | undefined;
      } else if (body.listing_id) {
        listing = db
          .prepare(`SELECT * FROM listings WHERE id = ?`)
          .get(body.listing_id) as Listing | undefined;
      }

      if (!listing) {
        reply.code(400).send({ error: { code: "BAD_INPUT", message: "listing required" } });
        return reply;
      }

      const amountRupees = typeof body.amount === "number" && body.amount > 0
        ? Math.floor(body.amount)
        : listing.rent_monthly;
      const amountPaise = amountRupees * 100;

      const orderId = `order_${newId()}`;
      const id = newId();
      const ts = now();
      db.prepare(
        `INSERT INTO payments (id, listing_id, payer_id, payee_id, amount, currency, rzp_order_id, rzp_payment_id, rzp_signature, status, for_month, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'INR', ?, NULL, NULL, 'created', ?, ?, ?)`,
      ).run(
        id,
        listing.id,
        user.id,
        listing.owner_id,
        amountRupees,
        orderId,
        body.for_month ?? null,
        ts,
        ts,
      );
      audit({
        actorId: user.id,
        action: "payment.order_create",
        entity: "payments",
        entityId: id,
        ip: req.ip,
        ua: req.headers["user-agent"] ?? null,
        payload: { rzp_order_id: orderId, listing_id: listing.id, amount: amountRupees, booking_id: bookingId },
      });

      // Razorpay Orders API response shape (matches /v1/orders POST response).
      return reply.send({
        id: orderId,
        entity: "order",
        amount: amountPaise,
        amount_paid: 0,
        amount_due: amountPaise,
        currency: "INR",
        receipt: bookingId ? `bk_${bookingId}` : `lst_${listing.id}`,
        status: "created",
        attempts: 0,
        notes: { listing_id: listing.id, payer_id: user.id, payee_id: listing.owner_id },
        created_at: Math.floor(ts / 1000),
        order_id: orderId,
        key_id: config.RZP.KEY_ID,
      });
    },
  );

  app.post("/pay/webhook", async (req, reply) => {
    const sig = (req.headers["x-razorpay-signature"] ?? "") as string;
    if (!sig) {
      reply.code(400).send({ error: { code: "MISSING_SIGNATURE", message: "missing signature" } });
      return reply;
    }
    const raw = rawBodyOf(req);
    const expected = crypto
      .createHmac("sha256", config.RZP.WEBHOOK_SECRET)
      .update(raw)
      .digest("hex");
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(sig, "utf8");
    const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
    if (!ok) {
      audit({
        actorId: null,
        action: "payment.webhook_bad_sig",
        entity: "payments",
        entityId: null,
        ip: req.ip,
        ua: req.headers["user-agent"] ?? null,
      });
      reply.code(400).send({ error: { code: "BAD_SIGNATURE", message: "signature mismatch" } });
      return reply;
    }

    const body = (req.body ?? {}) as WebhookPayload;
    const event = body.event ?? "";
    const entity = body.payload?.payment?.entity;

    if (event === "payment.captured" && entity?.order_id) {
      const orderId = entity.order_id;
      const payment = db
        .prepare(`SELECT * FROM payments WHERE rzp_order_id = ?`)
        .get(orderId) as Payment | undefined;
      if (!payment) {
        reply.code(404).send({ error: { code: "NOT_FOUND", message: "order unknown" } });
        return reply;
      }
      const ts = now();
      db.prepare(
        `UPDATE payments SET status='captured', rzp_payment_id=?, rzp_signature=?, updated_at=? WHERE id=?`,
      ).run(entity.id ?? null, sig, ts, payment.id);
      audit({
        actorId: payment.payer_id,
        action: "payment.captured",
        entity: "payments",
        entityId: payment.id,
        ip: req.ip,
        ua: req.headers["user-agent"] ?? null,
        payload: { rzp_order_id: orderId, rzp_payment_id: entity.id, amount: payment.amount },
      });

      const existingRenter = db
        .prepare(`SELECT id FROM renter_records WHERE listing_id = ? AND student_id = ?`)
        .get(payment.listing_id, payment.payer_id) as { id: string } | undefined;
      if (!existingRenter) {
        const rid = newId();
        db.prepare(
          `INSERT INTO renter_records (id, listing_id, student_id, source, active, started_at, ended_at, created_at)
           VALUES (?, ?, ?, 'platform_payment', 1, ?, NULL, ?)`,
        ).run(rid, payment.listing_id, payment.payer_id, ts, ts);
        audit({
          actorId: null,
          action: "renter.create_from_payment",
          entity: "renter_records",
          entityId: rid,
          payload: { listing_id: payment.listing_id, student_id: payment.payer_id, payment_id: payment.id },
        });
      } else {
        db.prepare(
          `UPDATE renter_records SET active=1, ended_at=NULL WHERE id=?`,
        ).run(existingRenter.id);
      }
    } else if (event === "payment.failed" && entity?.order_id) {
      const orderId = entity.order_id;
      const payment = db
        .prepare(`SELECT * FROM payments WHERE rzp_order_id = ?`)
        .get(orderId) as Payment | undefined;
      if (payment) {
        const ts = now();
        db.prepare(`UPDATE payments SET status='failed', updated_at=? WHERE id=?`).run(ts, payment.id);
        audit({
          actorId: payment.payer_id,
          action: "payment.failed",
          entity: "payments",
          entityId: payment.id,
          ip: req.ip,
          ua: req.headers["user-agent"] ?? null,
          payload: { rzp_order_id: orderId },
        });
      }
    }

    return reply.send({ ok: true });
  });
}
