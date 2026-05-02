import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { ulid } from "ulid";
import sharp from "sharp";
import { db, audit, newId, now } from "./index.js";
import { hashPassword } from "../auth/password.js";
import { config } from "../config.js";
import { logger } from "../logger.js";

type SeedUser = {
  key: string;
  email: string;
  password: string;
  full_name: string;
  role: "admin" | "owner" | "student";
  kyc_verified: 0 | 1;
};

type SeedListing = {
  key: string;
  ownerKey: string;
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
  near_landmark: string;
  amenities: string[];
  rules: string[];
  images: number;
  bgColor: { r: number; g: number; b: number };
};

type SeedBooking = {
  listingKey: string;
  studentKey: string;
  type: "visit" | "reserve";
  status: "pending" | "accepted" | "declined" | "cancelled" | "completed";
  visitOffsetDays?: number;
  message?: string;
};

type SeedPayment = {
  listingKey: string;
  payerKey: string;
  amount: number;
  for_month: string;
};

type SeedRenter = {
  listingKey: string;
  studentKey: string;
  source: "owner_marked" | "platform_payment";
};

type SeedFeedback = {
  listingKey: string;
  authorKey: string;
  rating: number;
  body: string;
};

const SHOOLINI = { lat: 30.9038, lng: 77.0930 };
const CHANDIGARH = { lat: 30.7333, lng: 76.7794 };
const DELHI_NCR = { lat: 28.5355, lng: 77.3910 };

function jitter(value: number, spread = 0.012): number {
  return value + (Math.random() - 0.5) * spread;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function makeSvg(title: string, subtitle: string, color: { r: number; g: number; b: number }): string {
  const overlay = `rgba(0,0,0,0.35)`;
  const stroke = `rgb(${Math.max(0, color.r - 40)}, ${Math.max(0, color.g - 40)}, ${Math.max(0, color.b - 40)})`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="rgba(0,0,0,0)"/>
      <stop offset="1" stop-color="${overlay}"/>
    </linearGradient>
  </defs>
  <rect x="40" y="40" width="1120" height="720" fill="none" stroke="${stroke}" stroke-width="6" rx="24"/>
  <rect x="0" y="500" width="1200" height="300" fill="url(#g)"/>
  <text x="80" y="640" font-family="Arial, sans-serif" font-size="56" font-weight="700" fill="#ffffff">${escapeXml(title)}</text>
  <text x="80" y="700" font-family="Arial, sans-serif" font-size="32" font-weight="400" fill="#f5f5f5">${escapeXml(subtitle)}</text>
  <text x="80" y="120" font-family="Arial, sans-serif" font-size="40" font-weight="700" fill="#ffffff" opacity="0.85">GharSetu</text>
</svg>`;
}

async function generateImage(
  filePath: string,
  title: string,
  subtitle: string,
  bg: { r: number; g: number; b: number },
): Promise<void> {
  const svg = makeSvg(title, subtitle, bg);
  await sharp({
    create: {
      width: 1200,
      height: 800,
      channels: 3,
      background: bg,
    },
  })
    .composite([{ input: Buffer.from(svg) }])
    .webp({ quality: 70, effort: 4 })
    .toFile(filePath);
}

const SEED_USERS: SeedUser[] = [
  {
    key: "admin",
    email: (config.ADMIN_EMAIL ?? "admin@gharsetu.local").toLowerCase(),
    password: config.ADMIN_PASSWORD ?? "Admin@2026!",
    full_name: "GharSetu Admin",
    role: "admin",
    kyc_verified: 1,
  },
  {
    key: "owner1",
    email: "owner@gharsetu.local",
    password: "Owner@2026!",
    full_name: "Suresh Verma",
    role: "owner",
    kyc_verified: 1,
  },
  {
    key: "owner2",
    email: "owner2@gharsetu.local",
    password: "Owner@2026!",
    full_name: "Anita Kapoor",
    role: "owner",
    kyc_verified: 0,
  },
  {
    key: "student1",
    email: "student@gharsetu.local",
    password: "Student@2026!",
    full_name: "Akshit Thakur",
    role: "student",
    kyc_verified: 1,
  },
  {
    key: "student2",
    email: "student2@gharsetu.local",
    password: "Student@2026!",
    full_name: "Priya Sharma",
    role: "student",
    kyc_verified: 0,
  },
  {
    key: "student3",
    email: "student3@gharsetu.local",
    password: "Student@2026!",
    full_name: "Rahul Singh",
    role: "student",
    kyc_verified: 0,
  },
];

const SEED_LISTINGS: SeedListing[] = [
  {
    key: "l1",
    ownerKey: "owner1",
    title: "Sunny single room near Shoolini Gate 2",
    description:
      "Bright south-facing single room within a 3-minute walk of Shoolini University Gate 2. Includes a sturdy study table, full wardrobe, and an attached bathroom with 24x7 hot water. Quiet residential lane, vegetarian-only mess on the ground floor, and reliable Jio fibre wifi. Power backup covers fans, lights, and the router so you never lose study time. Ideal for serious B.Tech and BBA students who want zero commute.",
    property_type: "single_room",
    gender_pref: "male",
    rent_monthly: 7500,
    deposit: 7500,
    address_line: "House 14, Bajora Road, near Shoolini Gate 2",
    city: "Solan",
    state: "Himachal Pradesh",
    pincode: "173229",
    lat: jitter(SHOOLINI.lat),
    lng: jitter(SHOOLINI.lng),
    near_landmark: "200m from Shoolini University Gate 2",
    amenities: [
      "wifi",
      "hot_water",
      "attached_bath",
      "power_backup",
      "study_table",
      "wardrobe",
      "mess",
      "filtered_water",
    ],
    rules: ["No smoking", "Vegetarian only", "Visitors till 9pm"],
    images: 3,
    bgColor: { r: 224, g: 122, b: 95 },
  },
  {
    key: "l2",
    ownerKey: "owner1",
    title: "Twin-share PG room with balcony view of Solan hills",
    description:
      "Spacious twin-sharing room on the second floor with a private balcony overlooking the pine ridge. Two single beds, two wardrobes, two study tables, and AC for the warmer months. Three home-style meals a day included in the rent, with separate Jain options on request. CCTV at the main gate and a warden who lives on premise. Five minutes by shared cab to Shoolini, less than that on foot.",
    property_type: "shared_room",
    gender_pref: "female",
    rent_monthly: 6000,
    deposit: 6000,
    address_line: "Block C, Pine Ridge PG, Anji Road",
    city: "Solan",
    state: "Himachal Pradesh",
    pincode: "173212",
    lat: jitter(SHOOLINI.lat),
    lng: jitter(SHOOLINI.lng),
    near_landmark: "600m from Shoolini University main gate",
    amenities: [
      "wifi",
      "ac",
      "balcony",
      "mess",
      "cctv",
      "hot_water",
      "study_table",
      "wardrobe",
      "filtered_water",
    ],
    rules: ["No smoking", "No alcohol", "Visitors till 8pm", "Vegetarian only"],
    images: 3,
    bgColor: { r: 60, g: 145, b: 110 },
  },
  {
    key: "l3",
    ownerKey: "owner1",
    title: "Budget single room for boys near Shoolini Gate 1",
    description:
      "No-frills single room aimed at first-year students who want privacy on a tight budget. Common bathroom shared with two other rooms, geyser runs morning and evening, and the kitchen is open if you cook your own food. Wifi works well, parking available for one bike. Five-minute walk to the university shuttle pick-up point and ten minutes to the food street. Honest pricing, no hidden charges.",
    property_type: "single_room",
    gender_pref: "male",
    rent_monthly: 3500,
    deposit: 3500,
    address_line: "Plot 22, Solan Bypass Road",
    city: "Solan",
    state: "Himachal Pradesh",
    pincode: "173212",
    lat: jitter(SHOOLINI.lat),
    lng: jitter(SHOOLINI.lng),
    near_landmark: "350m from Shoolini Gate 1",
    amenities: ["wifi", "geyser", "kitchen", "parking", "wardrobe", "study_table"],
    rules: ["No smoking", "No loud music after 10pm"],
    images: 2,
    bgColor: { r: 90, g: 110, b: 180 },
  },
  {
    key: "l4",
    ownerKey: "owner2",
    title: "Premium full PG suite for serious students",
    description:
      "Furnished suite with a private bedroom, attached bath, working area, and a small lounge corner. Air conditioning, refrigerator, microwave, and a dedicated writing desk by the window. Daily housekeeping, weekly laundry, and curated weekday dinners by an in-house cook. Diesel power backup keeps everything running through Solan winters. Suited for PhD scholars and final-year students who need uninterrupted focus.",
    property_type: "full_pg",
    gender_pref: "any",
    rent_monthly: 14500,
    deposit: 15000,
    address_line: "Villa 7, Krishna Vihar, Saproon",
    city: "Solan",
    state: "Himachal Pradesh",
    pincode: "173211",
    lat: jitter(SHOOLINI.lat),
    lng: jitter(SHOOLINI.lng),
    near_landmark: "1.2km from Shoolini University, near Saproon market",
    amenities: [
      "wifi",
      "ac",
      "attached_bath",
      "hot_water",
      "power_backup",
      "parking",
      "kitchen",
      "laundry",
      "study_table",
      "wardrobe",
      "balcony",
      "cctv",
      "fridge",
      "geyser",
      "filtered_water",
    ],
    rules: ["No smoking", "No pets", "ID required at gate"],
    images: 3,
    bgColor: { r: 138, g: 96, b: 168 },
  },
  {
    key: "l5",
    ownerKey: "owner2",
    title: "Furnished 1BHK flat behind Shoolini, weekly cleaning",
    description:
      "Independent 1BHK on the first floor of a private home, ideal for two friends or a small family. Separate kitchen with stove and fridge, living area with sofa, and a bedroom with attached bath. Geyser, washing machine on the ground floor for shared use, and a parking spot for a small car or two bikes. Owner stays nearby and is responsive on WhatsApp. Quiet street, lots of natural light.",
    property_type: "flat",
    gender_pref: "any",
    rent_monthly: 12000,
    deposit: 24000,
    address_line: "First floor, Shanti Niwas, Behind Shoolini Campus",
    city: "Solan",
    state: "Himachal Pradesh",
    pincode: "173229",
    lat: jitter(SHOOLINI.lat),
    lng: jitter(SHOOLINI.lng),
    near_landmark: "Behind Shoolini University Boys Hostel",
    amenities: [
      "wifi",
      "kitchen",
      "fridge",
      "laundry",
      "hot_water",
      "geyser",
      "parking",
      "wardrobe",
      "balcony",
    ],
    rules: ["No smoking inside the flat", "No parties"],
    images: 2,
    bgColor: { r: 200, g: 160, b: 70 },
  },
  {
    key: "l6",
    ownerKey: "owner2",
    title: "Girls-only PG triple-sharing in Sector 15 Chandigarh",
    description:
      "Well-run girls PG in a calm Sector 15 lane, walking distance to Panjab University South Campus and a short auto ride to most coaching institutes. Triple sharing with individual lockable wardrobes and reading lights. Three meals a day, evening tea, and laundry twice a week. Manager lives on the premise, visitor entries logged at the gate, biometric access on the main door. Friendly, safe, and verified by current residents.",
    property_type: "shared_room",
    gender_pref: "female",
    rent_monthly: 9500,
    deposit: 9500,
    address_line: "House 1234, Sector 15-B",
    city: "Chandigarh",
    state: "Chandigarh",
    pincode: "160015",
    lat: jitter(CHANDIGARH.lat),
    lng: jitter(CHANDIGARH.lng),
    near_landmark: "5 min walk to Panjab University South Campus",
    amenities: [
      "wifi",
      "ac",
      "mess",
      "laundry",
      "cctv",
      "hot_water",
      "wardrobe",
      "study_table",
      "filtered_water",
      "power_backup",
    ],
    rules: ["No smoking", "No alcohol", "Visitors in lounge only", "Gate closes 10pm"],
    images: 3,
    bgColor: { r: 220, g: 90, b: 140 },
  },
  {
    key: "l7",
    ownerKey: "owner1",
    title: "Single AC room in Sector 22 near ISBT Chandigarh",
    description:
      "Air-conditioned single room in a long-running PG block, popular with NEET and CAT aspirants. Close to ISBT-43, the bus to Solan, and the rapid metro line under construction. Includes mattress, table fan, study table, wardrobe, and access to a shared common room with a TV. Three meals plus tea included; vegetarian and Jain options available on request.",
    property_type: "single_room",
    gender_pref: "any",
    rent_monthly: 11000,
    deposit: 11000,
    address_line: "SCO 88, Sector 22-C",
    city: "Chandigarh",
    state: "Chandigarh",
    pincode: "160022",
    lat: jitter(CHANDIGARH.lat),
    lng: jitter(CHANDIGARH.lng),
    near_landmark: "10 min walk to ISBT Sector 43",
    amenities: [
      "wifi",
      "ac",
      "mess",
      "hot_water",
      "study_table",
      "wardrobe",
      "power_backup",
      "filtered_water",
    ],
    rules: ["No smoking", "Visitors till 9pm"],
    images: 2,
    bgColor: { r: 70, g: 130, b: 180 },
  },
  {
    key: "l8",
    ownerKey: "owner2",
    title: "Co-ed studio flat in Noida Sector 62 IT corridor",
    description:
      "Compact studio in a managed building in Sector 62 Noida, walking distance to Fortis and the IT cluster. Furnished with a bed, study desk, two-burner stove, mini fridge, and window AC. High-speed wifi and DG power backup keep work-from-home reliable. Suited for interns, fresh graduates, or any working student who wants a private space without the friction of a flatmate.",
    property_type: "flat",
    gender_pref: "any",
    rent_monthly: 13500,
    deposit: 27000,
    address_line: "Tower B, Studio 408, Sector 62",
    city: "Noida",
    state: "Uttar Pradesh",
    pincode: "201309",
    lat: jitter(DELHI_NCR.lat),
    lng: jitter(DELHI_NCR.lng),
    near_landmark: "Opposite Fortis Hospital, Sector 62 Noida",
    amenities: [
      "wifi",
      "ac",
      "fridge",
      "kitchen",
      "power_backup",
      "parking",
      "cctv",
      "wardrobe",
      "study_table",
      "geyser",
    ],
    rules: ["No smoking inside", "No subletting"],
    images: 3,
    bgColor: { r: 50, g: 90, b: 110 },
  },
];

const SEED_BOOKINGS: SeedBooking[] = [
  {
    listingKey: "l1",
    studentKey: "student2",
    type: "visit",
    status: "pending",
    visitOffsetDays: 3,
    message: "Hi, can I visit on the weekend afternoon?",
  },
  {
    listingKey: "l2",
    studentKey: "student2",
    type: "reserve",
    status: "accepted",
    message: "Confirming for next semester. Will pay deposit on visit.",
  },
  {
    listingKey: "l3",
    studentKey: "student3",
    type: "visit",
    status: "declined",
    visitOffsetDays: 1,
    message: "Looking for a quiet room for B.Tech 1st year.",
  },
  {
    listingKey: "l6",
    studentKey: "student2",
    type: "visit",
    status: "pending",
    visitOffsetDays: 5,
    message: "Coming with parents, please share PG rules in advance.",
  },
];

const SEED_PAYMENTS: SeedPayment[] = [
  {
    listingKey: "l1",
    payerKey: "student1",
    amount: 7500,
    for_month: "2026-05",
  },
  {
    listingKey: "l4",
    payerKey: "student2",
    amount: 14500,
    for_month: "2026-05",
  },
];

const SEED_OWNER_RENTERS: SeedRenter[] = [
  {
    listingKey: "l5",
    studentKey: "student3",
    source: "owner_marked",
  },
];

const SEED_FEEDBACK: SeedFeedback[] = [
  {
    listingKey: "l1",
    authorKey: "student1",
    rating: 5,
    body: "Lived here for two semesters. Hot water never failed and the wifi was rock solid through finals.",
  },
  {
    listingKey: "l4",
    authorKey: "student2",
    rating: 4,
    body: "Spotless suite and the cook actually asks what you want to eat. Slightly pricey but you get what you pay for.",
  },
  {
    listingKey: "l5",
    authorKey: "student3",
    rating: 5,
    body: "Owner is genuinely helpful. The flat is bright and the kitchen has everything we needed from day one.",
  },
  {
    listingKey: "l2",
    authorKey: "student3",
    rating: 4,
    body: "Toured this place for a friend. The balcony view is real and the warden answered every question patiently.",
  },
  {
    listingKey: "l6",
    authorKey: "student1",
    rating: 3,
    body: "Heard mixed reviews from friends here. Security is tight but the food rotation gets repetitive.",
  },
  {
    listingKey: "l7",
    authorKey: "student2",
    rating: 4,
    body: "Visited during admissions week. Good central location but the rooms facing the road can be noisy.",
  },
];

export async function runSeed(): Promise<void> {
  const userCount = (
    db.prepare(`SELECT COUNT(*) AS c FROM users`).get() as { c: number }
  ).c;
  if (userCount > 0) {
    logger.info({ msg: "seed.skip", reason: "users.exist", count: userCount });
    return;
  }

  const startedAt = Date.now();

  const userHashes = await Promise.all(
    SEED_USERS.map(async (u) => ({ user: u, hash: await hashPassword(u.password) })),
  );

  await mkdir(config.UPLOADS_DIR, { recursive: true });

  const userIds = new Map<string, string>();
  const listingIds = new Map<string, string>();

  type GeneratedImage = { path: string; title: string; subtitle: string; bg: { r: number; g: number; b: number } };
  const imagesToGenerate: GeneratedImage[] = [];
  const imageRows: Array<{ id: string; listing_id: string; url: string; position: number }> = [];

  for (const u of SEED_USERS) userIds.set(u.key, newId());
  for (const l of SEED_LISTINGS) listingIds.set(l.key, newId());

  for (const l of SEED_LISTINGS) {
    const listingId = listingIds.get(l.key) as string;
    for (let i = 1; i <= l.images; i++) {
      const imgId = newId();
      const url = `/uploads/seed-${listingId}-${i}.webp`;
      const filePath = join(config.UPLOADS_DIR, `seed-${listingId}-${i}.webp`);
      imageRows.push({ id: imgId, listing_id: listingId, url, position: i - 1 });
      if (!existsSync(filePath)) {
        imagesToGenerate.push({
          path: filePath,
          title: l.title,
          subtitle: `${l.city} | Rs ${l.rent_monthly.toLocaleString("en-IN")} / month`,
          bg: l.bgColor,
        });
      }
    }
  }

  await Promise.all(
    imagesToGenerate.map((img) => generateImage(img.path, img.title, img.subtitle, img.bg)),
  );

  const counts = {
    users: 0,
    listings: 0,
    listing_images: 0,
    bookings: 0,
    payments: 0,
    renter_records: 0,
    feedback: 0,
    audit: 0,
  };

  const insertUser = db.prepare(
    `INSERT INTO users (id, email, phone, password_hash, full_name, role, preferred_lang, kyc_verified, kyc_method, kyc_payload, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const insertListing = db.prepare(
    `INSERT INTO listings (id, owner_id, title, description, property_type, gender_pref, rent_monthly, deposit, address_line, city, state, pincode, lat, lng, near_landmark, amenities, rules, available_from, status, view_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 0, ?, ?)`,
  );

  const insertImage = db.prepare(
    `INSERT INTO listing_images (id, listing_id, url, position, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  );

  const insertBooking = db.prepare(
    `INSERT INTO bookings (id, listing_id, student_id, owner_id, type, visit_at, message, status, ondc_order_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
  );

  const insertPayment = db.prepare(
    `INSERT INTO payments (id, listing_id, payer_id, payee_id, amount, currency, rzp_order_id, rzp_payment_id, rzp_signature, status, for_month, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'INR', ?, ?, ?, 'captured', ?, ?, ?)`,
  );

  const insertRenter = db.prepare(
    `INSERT INTO renter_records (id, listing_id, student_id, source, active, started_at, ended_at, created_at)
     VALUES (?, ?, ?, ?, 1, ?, NULL, ?)`,
  );

  const insertFeedback = db.prepare(
    `INSERT INTO feedback (id, listing_id, author_id, rating, body, is_verified_renter, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  const tx = db.transaction(() => {
    const ts = now();

    for (const { user, hash } of userHashes) {
      insertUser.run(
        userIds.get(user.key) as string,
        user.email,
        null,
        hash,
        user.full_name,
        user.role,
        "en",
        user.kyc_verified,
        user.kyc_verified ? "digilocker" : null,
        user.kyc_verified ? JSON.stringify({ verified: true, source: "seed" }) : null,
        ts,
        ts,
      );
      counts.users++;
    }

    for (const l of SEED_LISTINGS) {
      const ownerId = userIds.get(l.ownerKey);
      const listingId = listingIds.get(l.key);
      if (!ownerId || !listingId) throw new Error(`seed.missing_id ${l.key}`);
      insertListing.run(
        listingId,
        ownerId,
        l.title,
        l.description,
        l.property_type,
        l.gender_pref,
        l.rent_monthly,
        l.deposit,
        l.address_line,
        l.city,
        l.state,
        l.pincode,
        l.lat,
        l.lng,
        l.near_landmark,
        JSON.stringify(l.amenities),
        JSON.stringify(l.rules),
        ts,
        ts,
        ts,
      );
      counts.listings++;
    }

    for (const img of imageRows) {
      insertImage.run(img.id, img.listing_id, img.url, img.position, ts);
      counts.listing_images++;
    }

    const trackedRenters = new Set<string>();

    for (const b of SEED_BOOKINGS) {
      const listingId = listingIds.get(b.listingKey);
      const studentId = userIds.get(b.studentKey);
      const listing = SEED_LISTINGS.find((l) => l.key === b.listingKey);
      const ownerId = listing ? userIds.get(listing.ownerKey) : undefined;
      if (!listingId || !studentId || !ownerId) throw new Error(`seed.booking.missing ${b.listingKey}`);
      const visitAt = b.visitOffsetDays
        ? ts + b.visitOffsetDays * 24 * 60 * 60 * 1000
        : null;
      insertBooking.run(
        newId(),
        listingId,
        studentId,
        ownerId,
        b.type,
        visitAt,
        b.message ?? null,
        b.status,
        ts,
        ts,
      );
      counts.bookings++;
    }

    for (const p of SEED_PAYMENTS) {
      const listingId = listingIds.get(p.listingKey);
      const payerId = userIds.get(p.payerKey);
      const listing = SEED_LISTINGS.find((l) => l.key === p.listingKey);
      const payeeId = listing ? userIds.get(listing.ownerKey) : undefined;
      if (!listingId || !payerId || !payeeId) throw new Error(`seed.payment.missing ${p.listingKey}`);
      const orderUlid = ulid();
      const paymentUlid = ulid();
      insertPayment.run(
        newId(),
        listingId,
        payerId,
        payeeId,
        p.amount,
        `order_seed_${orderUlid}`,
        `pay_seed_${paymentUlid}`,
        `sig_seed_${ulid()}`,
        p.for_month,
        ts,
        ts,
      );
      counts.payments++;

      const renterKey = `${listingId}:${payerId}`;
      if (!trackedRenters.has(renterKey)) {
        insertRenter.run(newId(), listingId, payerId, "platform_payment", ts, ts);
        trackedRenters.add(renterKey);
        counts.renter_records++;
      }
    }

    for (const r of SEED_OWNER_RENTERS) {
      const listingId = listingIds.get(r.listingKey);
      const studentId = userIds.get(r.studentKey);
      if (!listingId || !studentId) throw new Error(`seed.renter.missing ${r.listingKey}`);
      const renterKey = `${listingId}:${studentId}`;
      if (!trackedRenters.has(renterKey)) {
        insertRenter.run(newId(), listingId, studentId, r.source, ts, ts);
        trackedRenters.add(renterKey);
        counts.renter_records++;
      }
    }

    for (const f of SEED_FEEDBACK) {
      const listingId = listingIds.get(f.listingKey);
      const authorId = userIds.get(f.authorKey);
      if (!listingId || !authorId) throw new Error(`seed.feedback.missing ${f.listingKey}`);
      const isVerified = trackedRenters.has(`${listingId}:${authorId}`) ? 1 : 0;
      insertFeedback.run(newId(), listingId, authorId, f.rating, f.body, isVerified, ts);
      counts.feedback++;
    }
  });

  tx();

  audit({
    actorId: userIds.get("admin") ?? null,
    action: "seed.run",
    entity: "system",
    entityId: null,
    payload: { ...counts, ms: Date.now() - startedAt },
  });
  counts.audit++;

  logger.info({
    msg: "seed.done",
    users: counts.users,
    listings: counts.listings,
    listing_images: counts.listing_images,
    bookings: counts.bookings,
    payments: counts.payments,
    renter_records: counts.renter_records,
    feedback: counts.feedback,
    audit_log: counts.audit,
    ms: Date.now() - startedAt,
  });
}
