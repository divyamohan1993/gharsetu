import type { FastifyInstance, FastifyRequest } from "fastify";
import { db, type Listing } from "../db/index.js";
import { searchSchema } from "../lib/validate.js";
import { buildLocals } from "../lib/render.js";
import { detectLang, makeT } from "../i18n.js";
import { haversineKm } from "../lib/geo.js";

const PAGE_SIZE = 20;

type SearchRow = Listing & { primary_image: string | null };
type SearchResult = SearchRow & { distance_km?: number };

type SearchInput = {
  q?: string;
  city?: string;
  min?: number;
  max?: number;
  type?: "single_room" | "shared_room" | "full_pg" | "flat";
  gender?: "male" | "female" | "any";
  amenities?: string[];
  sort: "recent" | "price_asc" | "price_desc";
  page: number;
  near_lat?: number;
  near_lng?: number;
};

function runSearch(input: SearchInput): { rows: SearchResult[]; total: number } {
  const where: string[] = [`l.status = 'active'`];
  const params: Array<string | number> = [];
  if (input.q) {
    where.push(
      `(l.title LIKE ? OR l.description LIKE ? OR l.address_line LIKE ? OR COALESCE(l.near_landmark,'') LIKE ?)`,
    );
    const like = `%${input.q}%`;
    params.push(like, like, like, like);
  }
  if (input.city) {
    where.push(`LOWER(l.city) = LOWER(?)`);
    params.push(input.city);
  }
  if (typeof input.min === "number") {
    where.push(`l.rent_monthly >= ?`);
    params.push(input.min);
  }
  if (typeof input.max === "number") {
    where.push(`l.rent_monthly <= ?`);
    params.push(input.max);
  }
  if (input.type) {
    where.push(`l.property_type = ?`);
    params.push(input.type);
  }
  if (input.gender && input.gender !== "any") {
    where.push(`(l.gender_pref = ? OR l.gender_pref = 'any')`);
    params.push(input.gender);
  }

  let order = `l.created_at DESC`;
  if (input.sort === "price_asc") order = `l.rent_monthly ASC, l.created_at DESC`;
  if (input.sort === "price_desc") order = `l.rent_monthly DESC, l.created_at DESC`;

  const whereSql = where.join(" AND ");
  const totalRow = db
    .prepare(`SELECT COUNT(*) AS c FROM listings l WHERE ${whereSql}`)
    .get(...params) as { c: number };

  const offset = (input.page - 1) * PAGE_SIZE;

  const fetchAll = Boolean(
    input.amenities && input.amenities.length > 0,
  ) || (typeof input.near_lat === "number" && typeof input.near_lng === "number");

  const limitClause = fetchAll ? "" : `LIMIT ? OFFSET ?`;
  const listParams = fetchAll ? params : [...params, PAGE_SIZE, offset];

  const rows = db
    .prepare(
      `SELECT l.*, (
          SELECT url FROM listing_images li
          WHERE li.listing_id = l.id
          ORDER BY position ASC, created_at ASC LIMIT 1
        ) AS primary_image
        FROM listings l
        WHERE ${whereSql}
        ORDER BY ${order}
        ${limitClause}`,
    )
    .all(...listParams) as SearchRow[];

  let filtered: SearchResult[] = rows;

  if (input.amenities && input.amenities.length > 0) {
    const wanted = input.amenities.map((s) => s.trim().toLowerCase()).filter(Boolean);
    filtered = filtered.filter((r) => {
      let arr: unknown;
      try {
        arr = JSON.parse(r.amenities);
      } catch {
        arr = [];
      }
      if (!Array.isArray(arr)) return false;
      const have = new Set(arr.map((x) => String(x).toLowerCase()));
      return wanted.every((a) => have.has(a));
    });
  }

  if (typeof input.near_lat === "number" && typeof input.near_lng === "number") {
    const lat = input.near_lat;
    const lng = input.near_lng;
    filtered = filtered
      .map((r) => ({
        ...r,
        distance_km: haversineKm(lat, lng, r.lat, r.lng),
      }))
      .sort((a, b) => (a.distance_km ?? 0) - (b.distance_km ?? 0));
  }

  let total = totalRow.c;
  if (fetchAll) {
    total = filtered.length;
    filtered = filtered.slice(offset, offset + PAGE_SIZE);
  }

  return { rows: filtered, total };
}

function parseQuery(req: FastifyRequest): SearchInput | { error: string } {
  const parsed = searchSchema.safeParse(req.query);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid query" };
  }
  return parsed.data as SearchInput;
}

export async function registerSearchRoutes(app: FastifyInstance): Promise<void> {
  app.get("/search", async (req, reply) => {
    const t = makeT(detectLang(req));
    const out = parseQuery(req);
    if ("error" in out) {
      reply.code(400);
      return reply.view(
        "search",
        buildLocals(
          req,
          reply,
          { title: t("search.title") },
          {
            results: [],
            total: 0,
            page: 1,
            pageSize: PAGE_SIZE,
            pages: 0,
            error: out.error,
          },
        ),
      );
    }
    const { rows, total } = runSearch(out);
    return reply.view(
      "search",
      buildLocals(
        req,
        reply,
        { title: t("search.title") },
        {
          results: rows,
          total,
          page: out.page,
          pageSize: PAGE_SIZE,
          pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
          error: null,
        },
      ),
    );
  });

  app.get("/api/search", async (req, reply) => {
    const out = parseQuery(req);
    if ("error" in out) {
      reply.code(400);
      return { error: { code: "BAD_QUERY", message: out.error } };
    }
    const { rows, total } = runSearch(out);
    return {
      data: rows,
      meta: {
        total,
        page: out.page,
        page_size: PAGE_SIZE,
        pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      },
    };
  });
}
