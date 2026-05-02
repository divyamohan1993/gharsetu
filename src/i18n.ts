import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyRequest } from "fastify";
import { config } from "./config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesDir = join(__dirname, "locales");

type Dict = Record<string, string>;

const en: Dict = JSON.parse(readFileSync(join(localesDir, "en.json"), "utf8"));
const hi: Dict = JSON.parse(readFileSync(join(localesDir, "hi.json"), "utf8"));

const dicts: Record<string, Dict> = { en, hi };

export type Lang = "en" | "hi";

export function detectLang(req: FastifyRequest): Lang {
  const cookieLang = (req.cookies?.["gs_lang"] ?? "").toLowerCase();
  if (cookieLang === "en" || cookieLang === "hi") return cookieLang;
  const headerLang = (req.headers["accept-language"] ?? "")
    .toLowerCase()
    .split(",")[0]
    ?.trim();
  if (headerLang?.startsWith("hi")) return "hi";
  return (config.DEFAULT_LANG as Lang) ?? "en";
}

export function t(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  const dict = dicts[lang] ?? en;
  let msg = dict[key] ?? en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      msg = msg.replace(new RegExp(`{${k}}`, "g"), String(v));
    }
  }
  return msg;
}

export function makeT(lang: Lang) {
  return (key: string, vars?: Record<string, string | number>) => t(lang, key, vars);
}
