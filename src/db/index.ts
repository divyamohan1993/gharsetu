import Database from "better-sqlite3";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../config.js";
import { logger } from "../logger.js";
import { ulid } from "ulid";

const __dirname = dirname(fileURLToPath(import.meta.url));

mkdirSync(dirname(config.DB_PATH), { recursive: true });
mkdirSync(config.UPLOADS_DIR, { recursive: true });

export const db = new Database(config.DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const schemaPath = join(__dirname, "schema.sql");
const schemaSql = readFileSync(schemaPath, "utf8");
// better-sqlite3 multi-statement loader (synchronous, in-process; not a shell call).
const runMulti = (db as unknown as { exec: (s: string) => void }).exec.bind(db);
runMulti(schemaSql);

logger.info({ msg: "db.ready", path: config.DB_PATH });

export function now(): number {
  return Date.now();
}

export function newId(): string {
  return ulid();
}

export function audit(args: {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  ip?: string | null;
  ua?: string | null;
  payload?: unknown;
}): void {
  const stmt = db.prepare(
    `INSERT INTO audit_log (id, actor_id, action, entity, entity_id, ip, ua, payload, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  stmt.run(
    newId(),
    args.actorId ?? null,
    args.action,
    args.entity,
    args.entityId ?? null,
    args.ip ?? null,
    args.ua ?? null,
    args.payload === undefined ? null : JSON.stringify(args.payload),
    now(),
  );
}

export type User = {
  id: string;
  email: string;
  phone: string | null;
  password_hash: string;
  full_name: string;
  role: "student" | "owner" | "admin";
  preferred_lang: string;
  kyc_verified: number;
  kyc_method: string | null;
  kyc_payload: string | null;
  created_at: number;
  updated_at: number;
};

export type Listing = {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  property_type: "single_room" | "shared_room" | "full_pg" | "flat";
  gender_pref: "male" | "female" | "any";
  rent_monthly: number;
  deposit: number;
  address_line: string;
  city: string;
  state: string;
  pincode: string;
  lat: number;
  lng: number;
  near_landmark: string | null;
  amenities: string;
  rules: string | null;
  available_from: number;
  status: "active" | "paused" | "rented" | "removed";
  view_count: number;
  created_at: number;
  updated_at: number;
};

export type ListingImage = {
  id: string;
  listing_id: string;
  url: string;
  position: number;
  created_at: number;
};

export type Booking = {
  id: string;
  listing_id: string;
  student_id: string;
  owner_id: string;
  type: "visit" | "reserve";
  visit_at: number | null;
  message: string | null;
  status: "pending" | "accepted" | "declined" | "cancelled" | "completed";
  ondc_order_id: string | null;
  created_at: number;
  updated_at: number;
};

export type Payment = {
  id: string;
  listing_id: string;
  payer_id: string;
  payee_id: string;
  amount: number;
  currency: string;
  rzp_order_id: string;
  rzp_payment_id: string | null;
  rzp_signature: string | null;
  status: "created" | "captured" | "failed" | "refunded";
  for_month: string | null;
  created_at: number;
  updated_at: number;
};

export type RenterRecord = {
  id: string;
  listing_id: string;
  student_id: string;
  source: "owner_marked" | "platform_payment";
  active: number;
  started_at: number;
  ended_at: number | null;
  created_at: number;
};

export type Feedback = {
  id: string;
  listing_id: string;
  author_id: string;
  rating: number;
  body: string;
  is_verified_renter: number;
  created_at: number;
};
