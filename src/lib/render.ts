import type { FastifyReply, FastifyRequest } from "fastify";
import { detectLang, makeT, type Lang } from "../i18n.js";
import type { User } from "../db/index.js";

export type ViewLocals = {
  t: ReturnType<typeof makeT>;
  lang: Lang;
  user?: User;
  csrf: string;
  flash?: { kind: "ok" | "err" | "info"; msg: string } | null;
  reqId: string;
  path: string;
  query: Record<string, unknown>;
  page: {
    title: string;
    description?: string;
    canonical?: string;
    ogImage?: string;
  };
};

export function buildLocals(
  req: FastifyRequest,
  reply: FastifyReply,
  pageMeta: ViewLocals["page"],
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  const lang = detectLang(req);
  const csrf = (reply as unknown as { generateCsrf?: () => string }).generateCsrf?.() ?? "";
  const flashCookie = req.cookies?.["gs_flash"];
  let flash: ViewLocals["flash"] = null;
  if (flashCookie) {
    try {
      flash = JSON.parse(decodeURIComponent(flashCookie));
    } catch {
      flash = null;
    }
    reply.clearCookie("gs_flash", { path: "/" });
  }
  const locals: ViewLocals & Record<string, unknown> = {
    t: makeT(lang),
    lang,
    user: req.user,
    csrf,
    flash,
    reqId: (req.id as string) ?? "",
    path: req.url,
    query: (req.query as Record<string, unknown>) ?? {},
    page: pageMeta,
    ...extra,
  };
  return locals as unknown as Record<string, unknown>;
}

export function setFlash(
  reply: FastifyReply,
  kind: "ok" | "err" | "info",
  msg: string,
): void {
  reply.setCookie(
    "gs_flash",
    encodeURIComponent(JSON.stringify({ kind, msg })),
    { path: "/", httpOnly: false, sameSite: "lax", maxAge: 30 },
  );
}

export function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
