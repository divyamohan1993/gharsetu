import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { rmSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

const PORT = process.env.SMOKE_PORT ? Number.parseInt(process.env.SMOKE_PORT, 10) : 8765;
const BASE = `http://127.0.0.1:${PORT}`;
const TMP_DB = join(tmpdir(), `gharsetu-test-${process.pid}.db`);
const TMP_UPLOADS = join(tmpdir(), `gharsetu-test-uploads-${process.pid}`);

const READY_TIMEOUT_MS = 60_000;
const READY_INTERVAL_MS = 250;

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  ingest(headers) {
    if (!headers) return;
    const raw = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : null;
    const setCookies = raw && raw.length > 0 ? raw : (() => {
      const single = headers.get?.("set-cookie");
      return single ? [single] : [];
    })();
    for (const sc of setCookies) {
      const [pair] = sc.split(";");
      if (!pair) continue;
      const eq = pair.indexOf("=");
      if (eq < 0) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      if (!name) continue;
      if (value === "" || /expires=Thu, 01 Jan 1970/i.test(sc)) {
        this.cookies.delete(name);
      } else {
        this.cookies.set(name, value);
      }
    }
  }

  header() {
    if (this.cookies.size === 0) return null;
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }

  get(name) {
    return this.cookies.get(name) ?? null;
  }
}

async function http(path, opts = {}, jar = null) {
  const headers = { ...(opts.headers ?? {}) };
  if (jar) {
    const cookie = jar.header();
    if (cookie) headers.cookie = cookie;
  }
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers,
    redirect: "manual",
  });
  if (jar) jar.ingest(res.headers);
  return res;
}

async function getCsrf(path, jar) {
  const res = await http(path, { headers: { accept: "text/html" } }, jar);
  const body = await res.text();
  const match = body.match(/name="_csrf"\s+value="([^"]+)"/);
  return { token: match ? match[1] : null, body, status: res.status };
}

function form(data) {
  return new URLSearchParams(data).toString();
}

async function postForm(path, data, jar, extraHeaders = {}) {
  return http(
    path,
    {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        accept: "text/html",
        ...extraHeaders,
      },
      body: form(data),
    },
    jar,
  );
}

async function postJson(path, data, jar, extraHeaders = {}) {
  return http(
    path,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        ...extraHeaders,
      },
      body: JSON.stringify(data),
    },
    jar,
  );
}

function cleanup() {
  try { if (existsSync(TMP_DB)) rmSync(TMP_DB, { force: true }); } catch { /* ignore */ }
  for (const ext of ["-wal", "-shm"]) {
    try { if (existsSync(TMP_DB + ext)) rmSync(TMP_DB + ext, { force: true }); } catch { /* ignore */ }
  }
  try { if (existsSync(TMP_UPLOADS)) rmSync(TMP_UPLOADS, { recursive: true, force: true }); } catch { /* ignore */ }
}

let serverProc = null;

before(async () => {
  cleanup();
  mkdirSync(TMP_UPLOADS, { recursive: true });

  const env = {
    ...process.env,
    NODE_ENV: "test",
    PORT: String(PORT),
    HOST: "127.0.0.1",
    DB_PATH: TMP_DB,
    UPLOADS_DIR: TMP_UPLOADS,
    SEED_ON_START: "1",
    COOKIE_SECURE: "0",
    JWT_SECRET: "test_secret_at_least_32_chars_xxxx",
    LOG_LEVEL: "warn",
    ADMIN_EMAIL: "admin@gharsetu.local",
    ADMIN_PASSWORD: "Admin@2026!",
    RATE_LIMIT_MAX: "10000",
  };

  serverProc = spawn("node", ["--import", "tsx/esm", "src/server.ts"], {
    cwd: repoRoot,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let serverLog = "";
  serverProc.stdout.on("data", (d) => { serverLog += d.toString(); });
  serverProc.stderr.on("data", (d) => { serverLog += d.toString(); });

  const exited = new Promise((_resolve, reject) => {
    serverProc.once("exit", (code, sig) => {
      reject(new Error(`server exited early code=${code} sig=${sig}\n${serverLog.slice(-4000)}`));
    });
  });

  const ready = (async () => {
    const deadline = Date.now() + READY_TIMEOUT_MS;
    let lastErr = null;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`${BASE}/healthz`);
        if (res.ok) {
          const body = await res.json();
          if (body && body.ok === true) return;
        }
      } catch (err) {
        lastErr = err;
      }
      await new Promise((r) => setTimeout(r, READY_INTERVAL_MS));
    }
    throw new Error(`server not ready in ${READY_TIMEOUT_MS}ms (last: ${lastErr?.message ?? "none"})\n${serverLog.slice(-4000)}`);
  })();

  await Promise.race([ready, exited]);
});

after(async () => {
  if (serverProc && serverProc.exitCode === null) {
    await new Promise((resolve) => {
      serverProc.once("exit", resolve);
      serverProc.kill("SIGTERM");
      setTimeout(() => {
        if (serverProc.exitCode === null) serverProc.kill("SIGKILL");
      }, 3000);
    });
  }
  cleanup();
});

test("GET /healthz returns ok", async () => {
  const res = await fetch(`${BASE}/healthz`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
});

test("GET / returns HTML home page mentioning GharSetu", async () => {
  const res = await fetch(`${BASE}/`, { headers: { accept: "text/html" } });
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.match(body, /<html/i);
  assert.match(body, /GharSetu/i);
});

test("GET /search lists at least one Shoolini-area listing", async () => {
  const res = await fetch(`${BASE}/search`, { headers: { accept: "text/html" } });
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.match(body, /Shoolini/i);
});

test("GET /api/search?city=Solan returns results", async () => {
  const res = await fetch(`${BASE}/api/search?city=Solan`, {
    headers: { accept: "application/json" },
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.data), "data must be an array");
  assert.ok(body.data.length > 0, "expected at least one Solan listing");
});

test("signup + login issues a session cookie", async () => {
  const jar = new CookieJar();
  const { token } = await getCsrf("/signup", jar);

  const email = `smoke_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@gharsetu.local`;
  const password = "SmokeUser@2026!";

  const signupRes = await postForm(
    "/signup",
    {
      _csrf: token ?? "",
      full_name: "Smoke Tester",
      email,
      password,
      role: "student",
      preferred_lang: "en",
    },
    jar,
  );
  assert.ok(
    signupRes.status === 302 || signupRes.status === 303 || signupRes.status === 200,
    `signup returned ${signupRes.status}`,
  );

  const loginJar = new CookieJar();
  const loginCsrf = await getCsrf("/login", loginJar);
  const loginRes = await postForm(
    "/login",
    { _csrf: loginCsrf.token ?? "", email, password },
    loginJar,
  );
  assert.ok(
    loginRes.status === 302 || loginRes.status === 303 || loginRes.status === 200,
    `login returned ${loginRes.status}`,
  );
  assert.ok(loginJar.get("gs_session"), "expected gs_session cookie after login");
});

test("authenticated student can POST /bookings for a known listing", async () => {
  const apiRes = await fetch(`${BASE}/api/search?city=Solan`);
  const apiBody = await apiRes.json();
  assert.ok(apiBody.data?.length > 0, "need at least one listing for booking test");
  const listingId = apiBody.data[0].id;

  const jar = new CookieJar();
  const loginCsrf = await getCsrf("/login", jar);
  const loginRes = await postForm(
    "/login",
    {
      _csrf: loginCsrf.token ?? "",
      email: "student@gharsetu.local",
      password: "Student@2026!",
    },
    jar,
  );
  assert.ok(
    loginRes.status === 302 || loginRes.status === 303 || loginRes.status === 200,
    `seeded student login returned ${loginRes.status}`,
  );
  assert.ok(jar.get("gs_session"), "seeded student must get session cookie");

  const detail = await getCsrf(`/listings/${listingId}`, jar);
  const visitAt = Date.now() + 3 * 24 * 60 * 60 * 1000;
  const bookingRes = await postForm(
    "/bookings",
    {
      _csrf: detail.token ?? "",
      listing_id: listingId,
      type: "visit",
      visit_at: String(visitAt),
      message: "Smoke test visit request",
    },
    jar,
  );
  assert.ok(
    bookingRes.status >= 200 && bookingRes.status < 400,
    `booking POST returned ${bookingRes.status}`,
  );
});

test("POST /pay/order returns an order_id", async () => {
  const jar = new CookieJar();
  const loginCsrf = await getCsrf("/login", jar);
  await postForm(
    "/login",
    {
      _csrf: loginCsrf.token ?? "",
      email: "student@gharsetu.local",
      password: "Student@2026!",
    },
    jar,
  );

  const apiRes = await fetch(`${BASE}/api/search?city=Solan`);
  const apiBody = await apiRes.json();
  const listingId = apiBody.data[0].id;

  const detail = await getCsrf(`/listings/${listingId}`, jar);
  const orderRes = await postForm(
    "/pay/order",
    { _csrf: detail.token ?? "", listing_id: listingId, amount: "5000" },
    jar,
    { accept: "application/json" },
  );
  assert.equal(orderRes.status, 200, `expected 200, got ${orderRes.status}`);
  const body = await orderRes.json();
  const orderId = body.order_id ?? body.data?.order_id ?? body.id;
  assert.ok(typeof orderId === "string" && orderId.startsWith("order_"), `unexpected order_id: ${orderId}`);
});

test("POST /ondc/v1/search returns ACK", async () => {
  const txnId = `txn_${Date.now()}`;
  const messageId = `msg_${Date.now()}`;
  const ctx = {
    domain: "ONDC:RET11",
    country: "IND",
    city: "std:0792",
    action: "search",
    core_version: "1.1.0",
    bap_id: "buyer.example.com",
    bap_uri: "https://buyer.example.com/ondc/v1",
    transaction_id: txnId,
    message_id: messageId,
    timestamp: new Date().toISOString(),
    ttl: "PT30S",
  };
  const payload = {
    context: ctx,
    message: {
      intent: {
        category: { id: "PG_Rental" },
        fulfillment: {
          end: { location: { gps: "30.9038,77.0930", address: { city: "Solan" } } },
        },
      },
    },
  };
  const res = await postJson("/ondc/v1/search", payload, null);
  assert.equal(res.status, 200, `expected 200, got ${res.status}`);
  const body = await res.json();
  const status = body?.message?.ack?.status ?? body?.ack?.status;
  assert.equal(status, "ACK", `expected ack ACK, got ${JSON.stringify(body)}`);
});

test("GET /admin without admin cookie is blocked", async () => {
  const res = await http("/admin", { headers: { accept: "text/html" } });
  assert.ok(
    res.status === 401 || res.status === 403 || res.status === 302 || res.status === 303,
    `expected 401/403/redirect, got ${res.status}`,
  );
});

test("GET /healthz body shape", async () => {
  const res = await fetch(`${BASE}/healthz`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
});
