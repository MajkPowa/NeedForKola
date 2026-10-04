import { before, after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { pruneExpired } from "../src/retention.js";
let mf, db, sessionCookie, csrf;
const token = randomBytes(32).toString("hex");
const origin = "https://store.test";
async function request(path, method = "GET", data, extra = {}) {
  const headers = { Origin: origin, "X-NFW-Request": "1", ...extra };
  if (data !== undefined) headers["Content-Type"] = "application/json";
  const r = await mf.dispatchFetch(origin + path, {
    method,
    headers,
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  let json;
  try {
    json = await r.json();
  } catch {}
  return { r, json };
}
const admin = (path, method = "GET", data) =>
  request("/api/admin/" + path, method, data, {
    Cookie: sessionCookie,
    "X-CSRF-Token": csrf,
  });
const customer = {
  name: "Test Customer",
  email: "test@example.invalid",
  phone: "+420700000001",
  address: "Test 1",
  city: "Ostrava",
  postalCode: "70000",
  country: "CZ",
};
let setting,
  productId = "test-wheel",
  productVersion,
  order;
const checkoutBody = () => ({
  idempotencyKey: randomUUID(),
  catalogVersion: setting.version,
  items: [{ productId, quantity: 1, version: productVersion }],
  customer,
  shippingMethod: "pickup",
  paymentMethod: "bank_transfer",
  termsAccepted: true,
  termsVersion: "2026-10-04",
});
before(async () => {
  const modules = [
    {
      type: "ESModule",
      path: resolve("dist/worker.js"),
      contents: await readFile("dist/worker.js", "utf8"),
    },
  ];
  for (const f of await readdir("dist"))
    if (/\.(html|css|txt)$/.test(f))
      modules.push({
        type: "Text",
        path: resolve("dist/" + f),
        contents: await readFile("dist/" + f, "utf8"),
      });
  mf = new Miniflare(
    convertV4MiniflareOptions({
      modules,
      compatibilityDate: "2026-10-04",
      compatibilityFlags: ["nodejs_compat"],
      d1Databases: ["DB"],
      bindings: {
        ENVIRONMENT: "test",
        TRANSACTIONAL_CONFIRMATIONS_READY: "true",
        SECURITY_SECRET: randomBytes(32).toString("hex"),
        SITE_URL: origin,
        ALLOWED_ORIGINS: origin + ",https://oarts.cz",
      },
    }),
  );
  db = await mf.getD1Database("DB");
  const migration = (
    await Promise.all(
      (await readdir("migrations"))
        .sort()
        .map((f) => readFile("migrations/" + f, "utf8")),
    )
  ).join("\n");
  for (const sql of migration
    .split(/(?=^(?:CREATE|INSERT|ALTER|PRAGMA))/m)
    .filter((x) => x.trim()))
    await db.prepare(sql).run();
  await db
    .prepare("INSERT INTO admins(id,label,key_hash,created_at) VALUES(?,?,?,?)")
    .bind(
      "test-admin",
      "Test admin",
      createHash("sha256").update(token).digest("hex"),
      new Date().toISOString(),
    )
    .run();
});
beforeEach(async () => {
  await db.prepare("DELETE FROM rate_limits").run();
});
after(async () => {
  await mf?.dispose();
});
test("health, empty catalogue, no public admin or CORS credential leak", async () => {
  assert.equal((await request("/api/health")).r.status, 200);
  const c = await request("/api/catalog");
  assert.equal(c.json.orderingEnabled, false);
  assert.deepEqual(c.json.items, []);
  assert.equal((await request("/api/admin/orders")).r.status, 401);
  const cross = await request(
    "/api/enquiries",
    "POST",
    { ...customer, message: "test" },
    { Origin: "https://attacker.invalid" },
  );
  assert.equal(cross.r.status, 403);
  const opts = await request("/api/enquiries", "OPTIONS", undefined, {
    Origin: "https://oarts.cz",
  });
  assert.equal(opts.r.status, 204);
  assert.equal(
    opts.r.headers.get("access-control-allow-origin"),
    "https://oarts.cz",
  );
  assert.equal(opts.r.headers.get("access-control-allow-credentials"), null);
});
test("enquiries and complaints persist contact and blocked outbox; validation rejects injection shapes", async () => {
  const r = await request("/api/enquiries", "POST", {
    ...customer,
    reference: "NFW-R001",
    source: "gallery",
    message: "<script>alert(1)</script>",
  });
  assert.equal(r.r.status, 201, JSON.stringify(r.json));
  assert.match(r.json.reference, /^NFW-P-/);
  assert.equal(r.json.emailStatus, "blocked");
  const row = await db
    .prepare("SELECT * FROM enquiries WHERE id=?")
    .bind(r.json.id)
    .first();
  assert.equal(row.product_reference, "NFW-R001");
  assert.equal(
    (await db.prepare("SELECT count(*) n FROM outbox").first()).n,
    1,
  );
  const invalid = await request("/api/enquiries", "POST", {
    name: "a",
    email: "bad",
  });
  assert.equal(invalid.r.status, 422);
  const complaint = await request("/api/requests", "POST", {
    ...customer,
    kind: "complaint",
    orderReference: "OLD-1",
    message: "Damage noted",
  });
  assert.equal(complaint.r.status, 201);
  assert.equal(
    (
      await db
        .prepare("SELECT count(*) n FROM enquiries WHERE kind='complaint'")
        .first()
    ).n,
    1,
  );
});
test("admin authentication, session flags, CSRF and settings validation", async () => {
  const r = await request("/api/admin/login", "POST", { token });
  assert.equal(r.r.status, 200, JSON.stringify(r.json));
  csrf = r.json.csrf;
  sessionCookie = r.r.headers.get("set-cookie").split(";")[0];
  assert.match(
    r.r.headers.get("set-cookie"),
    /Secure; HttpOnly; SameSite=Strict/,
  );
  assert.equal((await admin("session")).r.status, 200);
  setting = (await admin("settings")).json;
  assert.equal(
    (
      await request(
        "/api/admin/settings",
        "PUT",
        { ...setting },
        { Cookie: sessionCookie },
      )
    ).r.status,
    403,
  );
  const bad = await admin("settings", "PUT", {
    ...setting,
    orderingEnabled: true,
  });
  assert.equal(bad.r.status, 422);
  const valid = {
    ...setting,
    orderingEnabled: true,
    offersEnabled: true,
    legalReady: true,
    taxMode: "vat_included",
    termsVersion: "2026-10-04",
    bankAccount: "TEST-ACCOUNT",
    shippingMethods: [
      {
        id: "pickup",
        label: "Pickup",
        priceCents: 0,
        deliveryText: "After agreement",
      },
    ],
    paymentMethods: [
      { id: "bank_transfer", label: "Transfer", instructions: "Test only" },
    ],
  };
  const saved = await admin("settings", "PUT", valid);
  assert.equal(saved.r.status, 200, JSON.stringify(saved.json));
  setting = saved.json;
});
test("product publication requires confirmed data and stock uses audited movements", async () => {
  const input = {
    sku: "TEST-SKU",
    title: "Test wheel set",
    description: "Testing",
    specs: [{ label: "Size", value: "20" }],
    image: "assets/real-wheels/nfw-r001/asset-055.webp",
    priceCents: 500000,
    wheelsPerSet: 4,
    confirmed: false,
    published: true,
  };
  assert.equal(
    (await admin("products/" + productId, "PUT", input)).r.status,
    422,
  );
  assert.equal(
    (await admin("products/" + productId, "PUT", { ...input, confirmed: true }))
      .r.status,
    200,
  );
  const p = (await admin("products")).json.items[0];
  assert.equal(p.on_hand, 0);
  const move = await admin("products/" + productId + "/movements", "POST", {
    version: p.version,
    delta: 1,
    reason: "Test receipt",
  });
  assert.equal(move.r.status, 200, JSON.stringify(move.json));
  const c = (await request("/api/catalog")).json;
  assert.equal(c.items[0].stockAvailable, 1);
  assert.equal(c.items[0].priceCents, 500000);
  productVersion = c.items[0].version;
});
test("concurrent purchases cannot oversell; duplicate checkout is idempotent and snapshots immutable", async () => {
  const b1 = checkoutBody(),
    b2 = checkoutBody();
  const results = await Promise.all([
    request("/api/checkout", "POST", { ...b1, totalCents: 1 }),
    request("/api/checkout", "POST", b2),
  ]);
  assert.deepEqual(
    results.map((x) => x.r.status).sort(),
    [201, 409],
    JSON.stringify(results.map((x) => x.json)),
  );
  const win = results.findIndex((x) => x.r.status === 201),
    payload = win === 0 ? { ...b1, totalCents: 1 } : b2;
  order = results[win].json;
  assert.equal(order.totalCents, 500000);
  const retry = await request("/api/checkout", "POST", payload);
  assert.equal(retry.r.status, 201, JSON.stringify(retry.json));
  assert.equal(retry.json.id, order.id);
  assert.equal(
    (await db.prepare("SELECT count(*) n FROM orders").first()).n,
    1,
  );
  assert.equal(
    (
      await db
        .prepare("SELECT reserved FROM products WHERE id=?")
        .bind(productId)
        .first()
    ).reserved,
    1,
  );
  await assert.rejects(
    db
      .prepare("UPDATE orders SET total_cents=1 WHERE id=?")
      .bind(order.id)
      .run(),
    /IMMUTABLE_ORDER/,
  );
  const conflict = await request("/api/checkout", "POST", {
    ...payload,
    customer: { ...customer, name: "Changed" },
  });
  assert.equal(conflict.r.status, 409);
});
test("cancel releases reservation exactly once and prevents impossible stock adjustment", async () => {
  const p = (await admin("products")).json.items[0];
  const negative = await admin("products/" + productId + "/movements", "POST", {
    version: p.version,
    delta: -1,
    reason: "Cannot consume reserved",
  });
  assert.equal(negative.r.status, 409);
  let row = (await admin("orders")).json.items[0];
  const cancel = await admin("orders/" + row.id + "/status", "POST", {
    version: row.version,
    status: "cancelled",
    reason: "Test cancellation",
  });
  assert.equal(cancel.r.status, 200, JSON.stringify(cancel.json));
  assert.equal(
    (
      await db
        .prepare("SELECT reserved FROM products WHERE id=?")
        .bind(productId)
        .first()
    ).reserved,
    0,
  );
  const repeat = await admin("orders/" + row.id + "/status", "POST", {
    version: row.version,
    status: "cancelled",
    reason: "Duplicate",
  });
  assert.equal(repeat.r.status, 409);
  assert.equal(
    (
      await db
        .prepare("SELECT count(*) n FROM stock_movements WHERE kind='release'")
        .first()
    ).n,
    1,
  );
});
test("private offer token hashes, customer acceptance creates immutable custom order and rejects reuse", async () => {
  const enq = (await admin("enquiries")).json.items.find(
    (x) => x.kind === "enquiry",
  );
  const offer = await admin("offers", "POST", {
    enquiryId: enq.id,
    title: "Custom proposal",
    specification: "Confirmed test details",
    subtotalCents: 123000,
    shippingMethod: "pickup",
    paymentMethod: "bank_transfer",
    deliveryText: "Agreed test term",
    validDays: 7,
  });
  assert.equal(offer.r.status, 200, JSON.stringify(offer.json));
  const offerToken = new URL(offer.json.link).hash.slice(7);
  const row = await db
    .prepare("SELECT token_hash FROM offers WHERE id=?")
    .bind(offer.json.id)
    .first();
  assert.notEqual(row.token_hash, offerToken);
  const view = await request("/api/offers/view", "POST", { token: offerToken });
  assert.equal(view.r.status, 200, JSON.stringify(view.json));
  assert.equal(view.json.totalCents, 123000);
  const b = {
    token: offerToken,
    idempotencyKey: randomUUID(),
    customer,
    termsAccepted: true,
    termsVersion: "2026-10-04",
  };
  const accepted = await request("/api/offers/accept", "POST", b);
  assert.equal(accepted.r.status, 201, JSON.stringify(accepted.json));
  assert.equal(accepted.json.totalCents, 123000);
  const reused = await request("/api/offers/accept", "POST", {
    ...b,
    idempotencyKey: randomUUID(),
  });
  assert.equal(reused.r.status, 409);
});
test("customer contact history cannot be overwritten by a later unauthenticated submission", async () => {
  const first = (await admin("enquiries")).json.items.find(
    (x) => x.kind === "enquiry",
  );
  const changed = await request("/api/enquiries", "POST", {
    ...customer,
    name: "Unverified new name",
    phone: "different",
    message: "New message",
  });
  assert.equal(changed.r.status, 201);
  const original = (await admin("enquiries")).json.items.find(
    (x) => x.id === first.id,
  );
  assert.equal(original.name, customer.name);
  assert.equal(original.phone, customer.phone);
  const newer = (await admin("enquiries")).json.items.find(
    (x) => x.id === changed.json.id,
  );
  assert.equal(newer.name, "Unverified new name");
  assert.equal(
    (
      await db
        .prepare("SELECT name FROM customers WHERE email=?")
        .bind(customer.email)
        .first()
    ).name,
    customer.name,
  );
  await assert.rejects(
    db
      .prepare("UPDATE enquiries SET contact_snapshot='{}' WHERE id=?")
      .bind(first.id)
      .run(),
    /IMMUTABLE_ENQUIRY_CONTACT/,
  );
});
test("stale product or delivery versions require review, not silent changed prices", async () => {
  const p = (await request("/api/catalog")).json.items[0];
  const stale = {
    ...checkoutBody(),
    items: [{ productId, quantity: 1, version: p.version - 1 }],
  };
  const productChanged = await request("/api/checkout", "POST", stale);
  assert.equal(productChanged.r.status, 409);
  assert.equal(productChanged.json.error.code, "PRODUCT_CHANGED");
  const deliveryChanged = await request("/api/checkout", "POST", {
    ...checkoutBody(),
    catalogVersion: setting.version - 1,
    items: [{ productId, quantity: 1, version: p.version }],
  });
  assert.equal(deliveryChanged.r.status, 409);
  assert.equal(deliveryChanged.json.error.code, "CATALOG_CHANGED");
});
test("paid and fulfilled transitions debit stock once; accepted terms are fully archived", async () => {
  const p = (await request("/api/catalog")).json.items[0];
  const result = await request("/api/checkout", "POST", {
    ...checkoutBody(),
    items: [{ productId, quantity: 1, version: p.version }],
  });
  assert.equal(result.r.status, 201, JSON.stringify(result.json));
  let row = (await admin("orders")).json.items.find(
    (x) => x.id === result.json.id,
  );
  const legal = JSON.parse(row.terms_snapshot);
  assert.equal(legal.version, "2026-10-04");
  assert.ok(
    legal.pages.find((p) => p.id === "obchodni-podminky").html.length > 1000,
  );
  assert.equal(
    (
      await admin("orders/" + row.id + "/status", "POST", {
        version: row.version,
        status: "fulfilled",
        reason: "Cannot skip payment",
      })
    ).r.status,
    409,
  );
  assert.equal(
    (
      await admin("orders/" + row.id + "/status", "POST", {
        version: row.version,
        status: "paid",
        reason: "Payment checked",
      })
    ).r.status,
    200,
  );
  row = (await admin("orders")).json.items.find((x) => x.id === result.json.id);
  assert.equal(
    (
      await admin("orders/" + row.id + "/status", "POST", {
        version: row.version,
        status: "fulfilled",
        reason: "Dispatched",
      })
    ).r.status,
    200,
  );
  const stock = await db
    .prepare("SELECT on_hand,reserved FROM products WHERE id=?")
    .bind(productId)
    .first();
  assert.equal(stock.on_hand, 0);
  assert.equal(stock.reserved, 0);
  await assert.rejects(
    db
      .prepare("UPDATE orders SET terms_snapshot='{}' WHERE id=?")
      .bind(row.id)
      .run(),
    /IMMUTABLE_TERMS/,
  );
});
test("retention removes expired unconverted CRM data but preserves recent communication and orders", async () => {
  const t = "2020-01-01T00:00:00.000Z";
  for (const id of ["old-expired", "old-recent"]) {
    await db
      .prepare(
        "INSERT INTO customers(id,email,name,created_at,updated_at) VALUES(?,?,?,?,?)",
      )
      .bind(id, id + "@example.invalid", "Old person", t, t)
      .run();
    await db
      .prepare(
        "INSERT INTO enquiries(id,reference,customer_id,kind,source,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
      )
      .bind(id, id, id, "enquiry", "contact", t, t)
      .run();
    await db
      .prepare(
        "INSERT INTO notes(id,entity_type,entity_id,body,actor,created_at) VALUES(?,?,?,?,?,?)",
      )
      .bind(id, "enquiry", id, "Old PII", "test", t)
      .run();
    await db
      .prepare(
        "INSERT INTO outbox(id,entity_type,entity_id,recipient,template,payload,created_at) VALUES(?,?,?,?,?,?,?)",
      )
      .bind(
        id,
        "enquiry",
        id,
        id + "@example.invalid",
        "enquiry_received",
        "{}",
        t,
      )
      .run();
  }
  assert.equal(
    (
      await admin("notes", "POST", {
        entityType: "enquiry",
        entityId: "old-recent",
        body: "Customer spoke with us today",
      })
    ).r.status,
    200,
  );
  const before = (await db.prepare("SELECT count(*) n FROM orders").first()).n;
  await pruneExpired({ DB: db });
  assert.equal(
    await db.prepare("SELECT id FROM enquiries WHERE id='old-expired'").first(),
    null,
  );
  assert.equal(
    await db
      .prepare("SELECT id FROM notes WHERE entity_id='old-expired'")
      .first(),
    null,
  );
  assert.equal(
    await db
      .prepare("SELECT id FROM outbox WHERE entity_id='old-expired'")
      .first(),
    null,
  );
  assert.equal(
    await db.prepare("SELECT id FROM customers WHERE id='old-expired'").first(),
    null,
  );
  assert.ok(
    await db.prepare("SELECT id FROM enquiries WHERE id='old-recent'").first(),
  );
  assert.equal(
    (await db.prepare("SELECT count(*) n FROM orders").first()).n,
    before,
  );
});
test("public input size and rate limit, unauthenticated private records remain hidden", async () => {
  assert.equal(
    (
      await request("/api/enquiries", "POST", {
        ...customer,
        message: "a".repeat(40000),
      })
    ).r.status,
    413,
  );
  for (let i = 0; i < 16; i++)
    await request("/api/enquiries", "POST", { ...customer, message: "limit" });
  assert.equal(
    (await request("/api/enquiries", "POST", { ...customer, message: "limit" }))
      .r.status,
    429,
  );
  assert.equal((await request("/api/admin/customers")).r.status, 401);
  assert.equal((await admin("logout", "POST", {})).r.status, 200);
  assert.equal((await admin("session")).r.status, 401);
});
