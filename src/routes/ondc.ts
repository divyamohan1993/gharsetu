// ===== REAL PROD CODE (replace stub on launch) =====
//
// Beckn / ONDC protocol — production wiring per ONDC API contract v1.2 (RET11/Services profile):
//
// Every request:
//   - Validate Authorization header per ONDC signing spec (Ed25519 + SHA-512 digest of payload).
//   - Lookup signer's subscriber via ONDC Registry (https://registry.ondc.org/lookup).
//   - Verify request schema against published Beckn JSON Schema for the action (search/select/init/...).
//   - Persist context.transaction_id + message_id for replay protection (24h window).
//
// /search:
//   request:  { context, message: { intent: { item: { descriptor }, fulfillment: { stops:[{location}] } } } }
//   response: 200 ACK immediately; async POST on_search to context.bap_uri with full catalog:
//     { context: {...action:"on_search"...},
//       message: { catalog: { "bpp/descriptor", "bpp/providers":[
//         { id, descriptor, locations:[...], items:[{ id, descriptor, price, location_ids, fulfillment_ids,
//                                                     "@ondc/org/statutory_reqs_packaged_commodities":..., quantity }] } ] } } }
//
// /select  -> on_select  (price/quote breakdown, fulfillment options)
// /init    -> on_init    (billing/fulfillment confirmed; quote with breakup)
// /confirm -> on_confirm (firm order with order.id and state="Created")
// /status  -> on_status  (order state poll)
// /cancel  -> on_cancel  (cancellation_reason_id)
// /update  -> on_update  (item/fulfillment patches)
// /rating  -> on_rating  (1-5 + feedback)
// /support -> on_support (callback_phone, email)
//
// Signing (outbound on_*):
//   const digest = createHash("sha512").update(JSON.stringify(payload)).digest("base64");
//   const signing_string = `(created): ${created}\n(expires): ${expires}\ndigest: SHA-512=${digest}`;
//   const sig = ed25519.sign(naclPrivateKey, signing_string);
//   headers["Authorization"] = `Signature keyId="${BPP_ID}|${unique_key_id}|ed25519",algorithm="ed25519",
//                               created="${created}",expires="${expires}",headers="(created) (expires) digest",
//                               signature="${sig}"`;
//
// =====================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { audit, db, newId, now, type Listing, type ListingImage } from "../db/index.js";
import { config } from "../config.js";

type BecknContext = {
  domain?: string;
  country?: string;
  city?: string;
  action?: string;
  core_version?: string;
  bap_id?: string;
  bap_uri?: string;
  bpp_id?: string;
  bpp_uri?: string;
  transaction_id?: string;
  message_id?: string;
  timestamp?: string;
  ttl?: string;
};

type BecknEnvelope = {
  context?: BecknContext;
  message?: Record<string, unknown>;
};

type ListingWithImage = Listing & { primary_image: string | null };

function logMessage(direction: "in" | "out", action: string, ctx: BecknContext, payload: unknown): void {
  db.prepare(
    `INSERT INTO ondc_messages (id, txn_id, message_id, action, direction, payload, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    newId(),
    ctx.transaction_id ?? "unknown",
    ctx.message_id ?? newId(),
    action,
    direction,
    JSON.stringify(payload),
    now(),
  );
}

function ackResponse(): { message: { ack: { status: "ACK" } } } {
  return { message: { ack: { status: "ACK" } } };
}

function nackResponse(code: string, message: string): {
  message: { ack: { status: "NACK" } };
  error: { code: string; message: string };
} {
  return {
    message: { ack: { status: "NACK" } },
    error: { code, message },
  };
}

function buildOnContext(inbound: BecknContext, action: string): BecknContext {
  return {
    domain: inbound.domain ?? config.ONDC.DOMAIN,
    country: inbound.country ?? config.ONDC.COUNTRY,
    city: inbound.city ?? config.ONDC.CITY,
    action,
    core_version: inbound.core_version ?? "1.2.0",
    bap_id: inbound.bap_id,
    bap_uri: inbound.bap_uri,
    bpp_id: config.ONDC.BPP_ID,
    bpp_uri: config.ONDC.BPP_URI,
    transaction_id: inbound.transaction_id,
    message_id: inbound.message_id ?? newId(),
    timestamp: new Date().toISOString(),
    ttl: "PT30S",
  };
}

async function postCallback(url: string, payload: unknown): Promise<void> {
  try {
    await globalThis.fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    audit({
      actorId: null,
      action: "ondc.callback_fail",
      entity: "ondc_messages",
      entityId: null,
      payload: { url, error: (err as Error).message },
    });
  }
}

function buildCatalog(intent: Record<string, unknown> | undefined): Record<string, unknown> {
  const search: { city?: string; q?: string; min?: number; max?: number } = {};
  if (intent && typeof intent === "object") {
    const i = intent as Record<string, unknown>;
    const fulfillment = i.fulfillment as { stops?: Array<{ location?: { city?: { name?: string } } }> } | undefined;
    const cityName = fulfillment?.stops?.[0]?.location?.city?.name;
    if (typeof cityName === "string") search.city = cityName;
    const item = i.item as { descriptor?: { name?: string } } | undefined;
    if (typeof item?.descriptor?.name === "string") search.q = item.descriptor.name;
    const ondcSearch = i["ondc_search"] as { city?: string; q?: string; min?: number; max?: number } | undefined;
    if (ondcSearch) Object.assign(search, ondcSearch);
  }

  const where: string[] = [`l.status = 'active'`];
  const params: Array<string | number> = [];
  if (search.city) {
    where.push(`LOWER(l.city) = LOWER(?)`);
    params.push(search.city);
  }
  if (search.q) {
    where.push(`(l.title LIKE ? OR l.description LIKE ?)`);
    params.push(`%${search.q}%`, `%${search.q}%`);
  }
  if (typeof search.min === "number") {
    where.push(`l.rent_monthly >= ?`);
    params.push(search.min);
  }
  if (typeof search.max === "number") {
    where.push(`l.rent_monthly <= ?`);
    params.push(search.max);
  }
  const rows = db
    .prepare(
      `SELECT l.*, (
          SELECT url FROM listing_images li WHERE li.listing_id = l.id
          ORDER BY position ASC LIMIT 1
        ) AS primary_image
        FROM listings l
        WHERE ${where.join(" AND ")}
        ORDER BY l.created_at DESC
        LIMIT 50`,
    )
    .all(...params) as ListingWithImage[];

  const items = rows.map((r) => ({
    id: r.id,
    descriptor: {
      name: r.title,
      short_desc: r.near_landmark ?? "",
      long_desc: r.description.slice(0, 1024),
      images: r.primary_image ? [r.primary_image] : [],
    },
    price: {
      currency: "INR",
      value: String(r.rent_monthly),
      maximum_value: String(r.rent_monthly),
    },
    category_id: r.property_type,
    location_ids: [r.id],
    fulfillment_ids: ["fulfillment-self-visit"],
    "@ondc/org/returnable": false,
    "@ondc/org/cancellable": true,
    "@ondc/org/available_on_cod": false,
  }));

  return {
    catalog: {
      "bpp/descriptor": { name: "GharSetu", short_desc: "Verified PG/room rentals" },
      "bpp/providers": [
        {
          id: config.ONDC.BPP_ID,
          descriptor: { name: "GharSetu" },
          locations: rows.map((r) => ({
            id: r.id,
            gps: `${r.lat},${r.lng}`,
            address: { locality: r.address_line, city: r.city, state: r.state, area_code: r.pincode },
          })),
          items,
          fulfillments: [
            { id: "fulfillment-self-visit", type: "Self-Pickup" },
          ],
        },
      ],
    },
  };
}

type ActionHandler = (
  req: FastifyRequest,
  reply: FastifyReply,
  ctx: BecknContext,
  message: Record<string, unknown>,
) => Promise<void> | void;

function makeHandler(action: string, onAction: string, build: (ctx: BecknContext, message: Record<string, unknown>) => Record<string, unknown>): ActionHandler {
  return async (req, reply, ctx, message) => {
    const onMessage = build(ctx, message);
    const onPayload = { context: buildOnContext(ctx, onAction), message: onMessage };
    logMessage("out", onAction, onPayload.context, onPayload);
    if (ctx.bap_uri) {
      const url = `${ctx.bap_uri.replace(/\/$/, "")}/${onAction}`;
      void postCallback(url, onPayload);
    }
  };
}

export async function registerOndcRoutes(app: FastifyInstance): Promise<void> {
  const handlers: Record<string, { action: string; handler: ActionHandler }> = {
    search: {
      action: "search",
      handler: makeHandler("search", "on_search", (_ctx, message) => {
        const intent = message.intent as Record<string, unknown> | undefined;
        return buildCatalog(intent);
      }),
    },
    select: {
      action: "select",
      handler: makeHandler("select", "on_select", (_ctx, message) => {
        const order = (message.order ?? {}) as Record<string, unknown>;
        return {
          order: {
            ...order,
            quote: {
              price: { currency: "INR", value: "0" },
              breakup: [],
              ttl: "PT15M",
            },
          },
        };
      }),
    },
    init: {
      action: "init",
      handler: makeHandler("init", "on_init", (_ctx, message) => {
        const order = (message.order ?? {}) as Record<string, unknown>;
        return {
          order: {
            ...order,
            payment: {
              type: "PRE-FULFILLMENT",
              collected_by: "BPP",
              status: "NOT-PAID",
              "@ondc/org/settlement_basis": "delivery",
            },
          },
        };
      }),
    },
    confirm: {
      action: "confirm",
      handler: makeHandler("confirm", "on_confirm", (_ctx, message) => {
        const order = (message.order ?? {}) as Record<string, unknown>;
        return {
          order: {
            ...order,
            id: `ondc_${newId()}`,
            state: "Created",
            created_at: new Date().toISOString(),
          },
        };
      }),
    },
    status: {
      action: "status",
      handler: makeHandler("status", "on_status", (_ctx, message) => {
        const orderId = (message.order_id as string | undefined) ?? "";
        return { order: { id: orderId, state: "Created" } };
      }),
    },
    cancel: {
      action: "cancel",
      handler: makeHandler("cancel", "on_cancel", (_ctx, message) => {
        const orderId = (message.order_id as string | undefined) ?? "";
        return { order: { id: orderId, state: "Cancelled" } };
      }),
    },
    update: {
      action: "update",
      handler: makeHandler("update", "on_update", (_ctx, message) => {
        const order = (message.order ?? {}) as Record<string, unknown>;
        return { order: { ...order, updated_at: new Date().toISOString() } };
      }),
    },
    rating: {
      action: "rating",
      handler: makeHandler("rating", "on_rating", () => ({
        feedback_form: {
          form: { url: `${config.ONDC.BPP_URI}/rating/form`, mime_type: "text/html" },
          required: false,
        },
      })),
    },
    support: {
      action: "support",
      handler: makeHandler("support", "on_support", () => ({
        phone: "+91-1800-000-0000",
        email: "support@gharsetu.local",
        uri: `${config.ONDC.BPP_URI}/support`,
      })),
    },
  };

  for (const [path, { action, handler }] of Object.entries(handlers)) {
    app.post<{ Body: BecknEnvelope }>(`/ondc/v1/${path}`, async (req, reply) => {
      const env = req.body ?? {};
      const ctx = env.context ?? {};
      const message = env.message ?? {};
      logMessage("in", action, ctx, env);
      if (ctx.action && ctx.action !== action) {
        const nack = nackResponse("CONTEXT_ACTION_MISMATCH", `expected ${action}, got ${ctx.action}`);
        return reply.code(400).send(nack);
      }
      reply.code(200).send(ackResponse());
      void Promise.resolve().then(() => handler(req, reply, ctx, message));
      return reply;
    });
  }

  app.get("/ondc/v1/lookup", async (_req, reply) => {
    return reply.send({
      subscriber_id: config.ONDC.BPP_ID,
      subscriber_url: config.ONDC.BPP_URI,
      type: "BPP",
      domain: config.ONDC.DOMAIN,
      country: config.ONDC.COUNTRY,
      city: config.ONDC.CITY,
      signing_public_key: "SIM_ed25519_public_key_base64==",
      encr_public_key: "SIM_x25519_public_key_base64==",
      valid_from: new Date(Date.now() - 86_400_000).toISOString(),
      valid_until: new Date(Date.now() + 31_536_000_000).toISOString(),
      status: "SUBSCRIBED",
      created: new Date(Date.now() - 86_400_000).toISOString(),
      updated: new Date().toISOString(),
    });
  });
}
