import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  audit,
  db,
  newId,
  now,
  type Feedback,
  type Listing,
  type ListingImage,
  type User,
} from "../db/index.js";
import { requireAuth } from "../auth/middleware.js";
import { listingSchema } from "../lib/validate.js";
import { saveImage } from "../lib/images.js";
import { buildLocals, setFlash } from "../lib/render.js";
import { detectLang, makeT } from "../i18n.js";

type MultipartFile = {
  type: "file";
  fieldname: string;
  filename: string;
  mimetype: string;
  toBuffer: () => Promise<Buffer>;
};
type MultipartField = {
  type: "field";
  fieldname: string;
  value: string;
};
type MultipartPart = MultipartFile | MultipartField;

type PartsRequest = {
  parts: () => AsyncIterableIterator<MultipartPart>;
  isMultipart: () => boolean;
};

type ParsedMultipart = {
  fields: Record<string, string | string[]>;
  files: Array<{ buf: Buffer; mimetype: string; filename: string }>;
};

async function parseMultipart(req: FastifyRequest, maxFiles: number): Promise<ParsedMultipart> {
  const out: ParsedMultipart = { fields: {}, files: [] };
  const mreq = req as unknown as PartsRequest;
  for await (const part of mreq.parts()) {
    if (part.type === "file") {
      if (out.files.length >= maxFiles) {
        // Drain the stream so the connection completes cleanly.
        await part.toBuffer();
        continue;
      }
      const buf = await part.toBuffer();
      if (buf.length === 0) continue;
      out.files.push({ buf, mimetype: part.mimetype, filename: part.filename });
    } else {
      const existing = out.fields[part.fieldname];
      if (existing === undefined) {
        out.fields[part.fieldname] = part.value;
      } else if (Array.isArray(existing)) {
        existing.push(part.value);
      } else {
        out.fields[part.fieldname] = [existing, part.value];
      }
    }
  }
  return out;
}

function fieldsToListingShape(fields: Record<string, string | string[]>): Record<string, unknown> {
  const single = (k: string): string | undefined => {
    const v = fields[k];
    if (v === undefined) return undefined;
    return Array.isArray(v) ? v[0] : v;
  };
  const list = (k: string): string[] => {
    const v = fields[k];
    if (v === undefined) return [];
    if (Array.isArray(v)) return v;
    return v
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
  };
  return {
    title: single("title"),
    description: single("description"),
    property_type: single("property_type"),
    gender_pref: single("gender_pref") ?? "any",
    rent_monthly: single("rent_monthly"),
    deposit: single("deposit") ?? 0,
    address_line: single("address_line"),
    city: single("city"),
    state: single("state"),
    pincode: single("pincode"),
    lat: single("lat"),
    lng: single("lng"),
    near_landmark: single("near_landmark") ?? "",
    amenities: list("amenities"),
    rules: list("rules"),
    available_from: single("available_from") ?? Date.now(),
  };
}

export async function registerListingsRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { id: string } }>("/listings/:id", async (req, reply) => {
    const t = makeT(detectLang(req));
    const listing = db
      .prepare(`SELECT * FROM listings WHERE id = ? AND status != 'removed'`)
      .get(req.params.id) as Listing | undefined;
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
    db.prepare(`UPDATE listings SET view_count = view_count + 1 WHERE id = ?`).run(listing.id);
    const images = db
      .prepare(`SELECT * FROM listing_images WHERE listing_id = ? ORDER BY position ASC, created_at ASC`)
      .all(listing.id) as ListingImage[];
    const owner = db
      .prepare(`SELECT id, full_name, kyc_verified, preferred_lang FROM users WHERE id = ?`)
      .get(listing.owner_id) as Pick<User, "id" | "full_name" | "kyc_verified" | "preferred_lang"> | undefined;
    const feedback = db
      .prepare(
        `SELECT f.*, u.full_name AS author_name
           FROM feedback f
           JOIN users u ON u.id = f.author_id
           WHERE f.listing_id = ?
           ORDER BY f.created_at DESC LIMIT 50`,
      )
      .all(listing.id) as Array<Feedback & { author_name: string }>;
    const ratingRow = db
      .prepare(`SELECT AVG(rating) AS avg, COUNT(*) AS c FROM feedback WHERE listing_id = ?`)
      .get(listing.id) as { avg: number | null; c: number };
    return reply.view(
      "listing-detail",
      buildLocals(
        req,
        reply,
        { title: listing.title, description: listing.description.slice(0, 160) },
        {
          listing,
          images,
          owner,
          feedback,
          rating: { avg: ratingRow.avg ?? 0, count: ratingRow.c },
        },
      ),
    );
  });

  app.get("/listings/new", { preHandler: requireAuth(["owner"]) }, async (req, reply) => {
    const t = makeT(detectLang(req));
    return reply.view(
      "listing-form",
      buildLocals(
        req,
        reply,
        { title: t("nav.list") },
        { mode: "new", listing: null, fieldErrors: {}, values: {}, existingImages: [] },
      ),
    );
  });

  app.post("/listings", { preHandler: requireAuth(["owner"]) }, async (req, reply) => {
    const t = makeT(detectLang(req));
    const user = req.user;
    if (!user) {
      reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Login required" } });
      return reply;
    }
    const parsed = await parseMultipart(req, 6);
    const shape = fieldsToListingShape(parsed.fields);
    const validated = listingSchema.safeParse(shape);
    if (!validated.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of validated.error.issues) {
        fieldErrors[issue.path.join(".") || "_"] = issue.message;
      }
      reply.code(400);
      return reply.view(
        "listing-form",
        buildLocals(
          req,
          reply,
          { title: t("nav.list") },
          { mode: "new", listing: null, fieldErrors, values: shape, existingImages: [] },
        ),
      );
    }
    const data = validated.data;
    const id = newId();
    const ts = now();
    db.prepare(
      `INSERT INTO listings (id, owner_id, title, description, property_type, gender_pref, rent_monthly, deposit,
        address_line, city, state, pincode, lat, lng, near_landmark, amenities, rules, available_from, status,
        view_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 0, ?, ?)`,
    ).run(
      id,
      user.id,
      data.title,
      data.description,
      data.property_type,
      data.gender_pref,
      data.rent_monthly,
      data.deposit,
      data.address_line,
      data.city,
      data.state,
      data.pincode,
      data.lat,
      data.lng,
      data.near_landmark || null,
      JSON.stringify(data.amenities),
      JSON.stringify(data.rules ?? []),
      data.available_from,
      ts,
      ts,
    );

    let position = 0;
    for (const f of parsed.files) {
      try {
        const saved = await saveImage(f.buf, f.mimetype);
        db.prepare(
          `INSERT INTO listing_images (id, listing_id, url, position, created_at) VALUES (?, ?, ?, ?, ?)`,
        ).run(newId(), id, saved.url, position, now());
        position++;
      } catch (err) {
        req.log.warn({ err, listing_id: id }, "image.save_failed");
      }
    }

    audit({
      actorId: user.id,
      action: "listing.create",
      entity: "listings",
      entityId: id,
      ip: req.ip,
      ua: req.headers["user-agent"] ?? null,
      payload: { city: data.city, rent: data.rent_monthly, images: parsed.files.length },
    });
    setFlash(reply, "ok", t("form.submit"));
    return reply.redirect(`/listings/${id}`);
  });

  app.get<{ Params: { id: string } }>(
    "/listings/:id/edit",
    { preHandler: requireAuth(["owner"]) },
    async (req, reply) => {
      const user = req.user!;
      const t = makeT(detectLang(req));
      const listing = db
        .prepare(`SELECT * FROM listings WHERE id = ? AND status != 'removed'`)
        .get(req.params.id) as Listing | undefined;
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
      if (listing.owner_id !== user.id) {
        reply.code(403).send({ error: { code: "FORBIDDEN", message: "Not your listing" } });
        return reply;
      }
      const images = db
        .prepare(`SELECT * FROM listing_images WHERE listing_id = ? ORDER BY position ASC`)
        .all(listing.id) as ListingImage[];
      let amen: string[] = [];
      let rules: string[] = [];
      try { amen = JSON.parse(listing.amenities); } catch { amen = []; }
      try { rules = JSON.parse(listing.rules ?? "[]"); } catch { rules = []; }
      return reply.view(
        "listing-form",
        buildLocals(
          req,
          reply,
          { title: t("common.edit") },
          {
            mode: "edit",
            listing,
            fieldErrors: {},
            values: { ...listing, amenities: amen, rules },
            existingImages: images,
          },
        ),
      );
    },
  );

  app.post<{ Params: { id: string } }>(
    "/listings/:id",
    { preHandler: requireAuth(["owner"]) },
    async (req, reply) => {
      const user = req.user!;
      const t = makeT(detectLang(req));
      const listing = db
        .prepare(`SELECT * FROM listings WHERE id = ? AND status != 'removed'`)
        .get(req.params.id) as Listing | undefined;
      if (!listing) {
        reply.code(404).send({ error: { code: "NOT_FOUND", message: "Listing not found" } });
        return reply;
      }
      if (listing.owner_id !== user.id) {
        reply.code(403).send({ error: { code: "FORBIDDEN", message: "Not your listing" } });
        return reply;
      }
      const parsed = await parseMultipart(req, 6);
      const shape = fieldsToListingShape(parsed.fields);
      const validated = listingSchema.safeParse(shape);
      if (!validated.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of validated.error.issues) {
          fieldErrors[issue.path.join(".") || "_"] = issue.message;
        }
        const images = db
          .prepare(`SELECT * FROM listing_images WHERE listing_id = ? ORDER BY position ASC`)
          .all(listing.id) as ListingImage[];
        reply.code(400);
        return reply.view(
          "listing-form",
          buildLocals(
            req,
            reply,
            { title: t("common.edit") },
            { mode: "edit", listing, fieldErrors, values: shape, existingImages: images },
          ),
        );
      }
      const data = validated.data;
      const ts = now();
      db.prepare(
        `UPDATE listings SET title=?, description=?, property_type=?, gender_pref=?, rent_monthly=?, deposit=?,
          address_line=?, city=?, state=?, pincode=?, lat=?, lng=?, near_landmark=?, amenities=?, rules=?,
          available_from=?, updated_at=? WHERE id=?`,
      ).run(
        data.title,
        data.description,
        data.property_type,
        data.gender_pref,
        data.rent_monthly,
        data.deposit,
        data.address_line,
        data.city,
        data.state,
        data.pincode,
        data.lat,
        data.lng,
        data.near_landmark || null,
        JSON.stringify(data.amenities),
        JSON.stringify(data.rules ?? []),
        data.available_from,
        ts,
        listing.id,
      );
      const existingCountRow = db
        .prepare(`SELECT COUNT(*) AS c FROM listing_images WHERE listing_id = ?`)
        .get(listing.id) as { c: number };
      let pos = existingCountRow.c;
      for (const f of parsed.files) {
        if (pos >= 6) break;
        try {
          const saved = await saveImage(f.buf, f.mimetype);
          db.prepare(
            `INSERT INTO listing_images (id, listing_id, url, position, created_at) VALUES (?, ?, ?, ?, ?)`,
          ).run(newId(), listing.id, saved.url, pos, now());
          pos++;
        } catch (err) {
          req.log.warn({ err, listing_id: listing.id }, "image.save_failed");
        }
      }
      audit({
        actorId: user.id,
        action: "listing.update",
        entity: "listings",
        entityId: listing.id,
        ip: req.ip,
        ua: req.headers["user-agent"] ?? null,
        payload: { city: data.city, rent: data.rent_monthly },
      });
      setFlash(reply, "ok", t("common.save"));
      return reply.redirect(`/listings/${listing.id}`);
    },
  );

  app.post<{ Params: { id: string } }>(
    "/listings/:id/delete",
    { preHandler: requireAuth(["owner"]) },
    async (req, reply) => {
      const user = req.user!;
      const listing = db
        .prepare(`SELECT * FROM listings WHERE id = ?`)
        .get(req.params.id) as Listing | undefined;
      if (!listing) {
        reply.code(404).send({ error: { code: "NOT_FOUND", message: "Listing not found" } });
        return reply;
      }
      if (listing.owner_id !== user.id) {
        reply.code(403).send({ error: { code: "FORBIDDEN", message: "Not your listing" } });
        return reply;
      }
      db.prepare(`UPDATE listings SET status='removed', updated_at=? WHERE id=?`).run(now(), listing.id);
      audit({
        actorId: user.id,
        action: "listing.delete",
        entity: "listings",
        entityId: listing.id,
        ip: req.ip,
        ua: req.headers["user-agent"] ?? null,
      });
      const t = makeT(detectLang(req));
      setFlash(reply, "ok", t("common.delete"));
      return reply.redirect("/owner/dashboard");
    },
  );
}
