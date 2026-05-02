import type { FastifyInstance } from "fastify";
import { db, type Listing, type ListingImage } from "../db/index.js";
import { buildLocals } from "../lib/render.js";
import { detectLang, makeT } from "../i18n.js";

type FeaturedListing = Listing & { primary_image: string | null };

export async function registerHomeRoutes(app: FastifyInstance): Promise<void> {
  app.get("/", async (req, reply) => {
    const rows = db
      .prepare(
        `SELECT l.*, (
            SELECT url FROM listing_images li
            WHERE li.listing_id = l.id
            ORDER BY position ASC, created_at ASC LIMIT 1
          ) AS primary_image
          FROM listings l
          WHERE l.status = 'active'
          ORDER BY l.created_at DESC
          LIMIT 6`,
      )
      .all() as FeaturedListing[];
    const lang = detectLang(req);
    const t = makeT(lang);
    return reply.view(
      "home",
      buildLocals(
        req,
        reply,
        { title: t("app.name"), description: t("app.tagline_long") },
        { featured: rows },
      ),
    );
  });

  app.get("/about", async (req, reply) => {
    const lang = detectLang(req);
    const t = makeT(lang);
    return reply.view(
      "about",
      buildLocals(req, reply, { title: t("footer.about") }, {}),
    );
  });

  app.post<{ Body: { lang?: string; next?: string } }>("/lang", async (req, reply) => {
    const wanted = (req.body?.lang ?? "").toLowerCase();
    const lang = wanted === "hi" ? "hi" : "en";
    reply.setCookie("gs_lang", lang, {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
    const next = typeof req.body?.next === "string" && req.body.next.startsWith("/")
      ? req.body.next
      : "/";
    return reply.redirect(next);
  });
}
