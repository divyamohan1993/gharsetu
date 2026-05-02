// ===== REAL PROD CODE (replace stub on launch) =====
//
// DigiLocker OAuth 2.0 (PKCE) — production wiring:
//
//   import crypto from "node:crypto";
//
//   // POST /verify/digilocker/init
//   const verifier = crypto.randomBytes(48).toString("base64url");
//   const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
//   const state = crypto.randomBytes(24).toString("base64url");
//   db.prepare(`INSERT INTO digilocker_pkce (state, verifier, user_id, created_at) VALUES (?, ?, ?, ?)`)
//     .run(state, verifier, req.user.id, Date.now());
//   const params = new URLSearchParams({
//     response_type: "code",
//     client_id: config.DIGILOCKER.CLIENT_ID,
//     redirect_uri: config.DIGILOCKER.REDIRECT_URI,
//     state,
//     code_challenge: challenge,
//     code_challenge_method: "S256",
//     scope: "Aadhaar",
//   });
//   reply.redirect(`${config.DIGILOCKER.AUTH_URL}?${params.toString()}`);
//
//   // GET /verify/digilocker/callback
//   const tokenRes = await fetch(config.DIGILOCKER.TOKEN_URL, {
//     method: "POST",
//     headers: { "content-type": "application/x-www-form-urlencoded" },
//     body: new URLSearchParams({
//       grant_type: "authorization_code",
//       code,
//       redirect_uri: config.DIGILOCKER.REDIRECT_URI,
//       client_id: config.DIGILOCKER.CLIENT_ID,
//       client_secret: config.DIGILOCKER.CLIENT_SECRET,
//       code_verifier: storedVerifier,
//     }).toString(),
//   });
//   const { access_token } = await tokenRes.json();
//   const eAadhaar = await fetch("https://api.digitallocker.gov.in/public/oauth2/3/eaadhaar",
//     { headers: { Authorization: `Bearer ${access_token}` } }).then(r => r.json());
//   // Store sanitized payload only — never store full Aadhaar number.
//
// =====================================================

import type { FastifyInstance } from "fastify";
import { audit, db, now } from "../db/index.js";
import { requireAuth } from "../auth/middleware.js";
import { buildLocals, setFlash } from "../lib/render.js";
import { detectLang, makeT } from "../i18n.js";
import { newId } from "../lib/id.js";

export async function registerVerificationRoutes(app: FastifyInstance): Promise<void> {
  app.get("/verify", { preHandler: requireAuth() }, async (req, reply) => {
    const t = makeT(detectLang(req));
    return reply.view(
      "verify",
      buildLocals(
        req,
        reply,
        { title: t("verify.h.title") },
        { kycVerified: req.user?.kyc_verified === 1 },
      ),
    );
  });

  app.post("/verify/digilocker/init", { preHandler: requireAuth() }, async (req, reply) => {
    const user = req.user!;
    const state = newId();
    const code = `SIM_${newId()}`;
    audit({
      actorId: user.id,
      action: "kyc.init",
      entity: "users",
      entityId: user.id,
      ip: req.ip,
      ua: req.headers["user-agent"] ?? null,
      payload: { method: "digilocker_simulated", state },
    });
    return reply.redirect(`/verify/digilocker/callback?code=${code}&state=${state}`);
  });

  app.get<{ Querystring: { code?: string; state?: string } }>(
    "/verify/digilocker/callback",
    { preHandler: requireAuth() },
    async (req, reply) => {
      const user = req.user!;
      const t = makeT(detectLang(req));
      const code = req.query.code ?? "";
      if (!code.startsWith("SIM_")) {
        audit({
          actorId: user.id,
          action: "kyc.fail",
          entity: "users",
          entityId: user.id,
          ip: req.ip,
          ua: req.headers["user-agent"] ?? null,
          payload: { reason: "bad_code_prefix" },
        });
        setFlash(reply, "err", t("verify.failed"));
        return reply.redirect("/verify");
      }
      const sanitized = {
        method: "digilocker_simulated",
        verified_at: now(),
        aadhaar_last4: "1234",
        name_on_id: user.full_name,
        dob_year: 2000,
      };
      db.prepare(
        `UPDATE users SET kyc_verified=1, kyc_method='digilocker', kyc_payload=?, updated_at=? WHERE id=?`,
      ).run(JSON.stringify(sanitized), now(), user.id);
      audit({
        actorId: user.id,
        action: "kyc.verify",
        entity: "users",
        entityId: user.id,
        ip: req.ip,
        ua: req.headers["user-agent"] ?? null,
        payload: { method: "digilocker_simulated" },
      });
      setFlash(reply, "ok", t("verify.success"));
      const target = user.role === "owner" ? "/owner/dashboard" : "/student/dashboard";
      return reply.redirect(target);
    },
  );
}
