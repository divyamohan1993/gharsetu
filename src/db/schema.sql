PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA synchronous = NORMAL;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  phone TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('student','owner','admin')),
  preferred_lang TEXT DEFAULT 'en',
  kyc_verified INTEGER DEFAULT 0,
  kyc_method TEXT,
  kyc_payload TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE TABLE IF NOT EXISTS listings (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  property_type TEXT CHECK(property_type IN ('single_room','shared_room','full_pg','flat')) NOT NULL,
  gender_pref TEXT CHECK(gender_pref IN ('male','female','any')) NOT NULL DEFAULT 'any',
  rent_monthly INTEGER NOT NULL,
  deposit INTEGER DEFAULT 0,
  address_line TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  pincode TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  near_landmark TEXT,
  amenities TEXT NOT NULL DEFAULT '[]',
  rules TEXT DEFAULT '[]',
  available_from INTEGER NOT NULL,
  status TEXT DEFAULT 'active' CHECK(status IN ('active','paused','rented','removed')),
  view_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_listings_city_status ON listings(city, status);
CREATE INDEX IF NOT EXISTS idx_listings_owner ON listings(owner_id);
CREATE INDEX IF NOT EXISTS idx_listings_geo ON listings(lat, lng);

CREATE TABLE IF NOT EXISTS listing_images (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  position INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_listing_images_listing ON listing_images(listing_id, position);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id),
  student_id TEXT NOT NULL REFERENCES users(id),
  owner_id TEXT NOT NULL REFERENCES users(id),
  type TEXT CHECK(type IN ('visit','reserve')) NOT NULL,
  visit_at INTEGER,
  message TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined','cancelled','completed')),
  ondc_order_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bookings_owner ON bookings(owner_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_student ON bookings(student_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_listing ON bookings(listing_id);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id),
  payer_id TEXT NOT NULL REFERENCES users(id),
  payee_id TEXT NOT NULL REFERENCES users(id),
  amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'INR',
  rzp_order_id TEXT NOT NULL UNIQUE,
  rzp_payment_id TEXT,
  rzp_signature TEXT,
  status TEXT DEFAULT 'created' CHECK(status IN ('created','captured','failed','refunded')),
  for_month TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payments_payer ON payments(payer_id);
CREATE INDEX IF NOT EXISTS idx_payments_payee ON payments(payee_id);

CREATE TABLE IF NOT EXISTS renter_records (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id),
  student_id TEXT NOT NULL REFERENCES users(id),
  source TEXT CHECK(source IN ('owner_marked','platform_payment')) NOT NULL,
  active INTEGER DEFAULT 1,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  created_at INTEGER NOT NULL,
  UNIQUE(listing_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_renter_student ON renter_records(student_id, active);
CREATE INDEX IF NOT EXISTS idx_renter_listing ON renter_records(listing_id, active);

CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id),
  author_id TEXT NOT NULL REFERENCES users(id),
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  body TEXT NOT NULL,
  is_verified_renter INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_feedback_listing ON feedback(listing_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  ip TEXT,
  ua TEXT,
  payload TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ondc_messages (
  id TEXT PRIMARY KEY,
  txn_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  action TEXT NOT NULL,
  direction TEXT CHECK(direction IN ('in','out')) NOT NULL,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ondc_txn ON ondc_messages(txn_id, created_at);

CREATE TABLE IF NOT EXISTS sessions (
  jti TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  revoked INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
