import legalPages from "../../data/legal/pages.json";
import {
  fail,
  text,
  email,
  integer,
  uuid,
  now,
  hash,
  randomToken,
  stmt,
  audit,
  assertStatement,
} from "./security.js";
export async function settings(env) {
  const row = await stmt(
    env,
    "SELECT value,version FROM settings WHERE id=1",
  ).first();
  if (!row) fail(503, "NOT_CONFIGURED", "Služba ještě není připravena.");
  return {
    ...JSON.parse(row.value),
    version: row.version,
    confirmationReady: env.TRANSACTIONAL_CONFIRMATIONS_READY === "true",
  };
}
export function ready(s) {
  return (
    s.termsVersion === legalPages.version &&
    s.confirmationReady === true &&
    s.legalReady === true &&
    ["vat_included", "non_vat_payer"].includes(s.taxMode) &&
    s.shippingMethods?.length > 0 &&
    s.paymentMethods?.length > 0 &&
    !!s.bankAccount
  );
}
export function product(row) {
  return {
    id: row.id,
    version: row.version,
    sku: row.sku,
    title: row.title,
    description: row.description,
    specs: JSON.parse(row.specs),
    image: row.image,
    priceCents: row.price_cents,
    currency: row.currency,
    wheelsPerSet: row.wheels_per_set,
    stockAvailable: row.on_hand - row.reserved,
  };
}
export async function catalog(env) {
  const s = await settings(env);
  const rows = await stmt(
    env,
    "SELECT * FROM products WHERE published=1 AND confirmed=1 ORDER BY title LIMIT 500",
  ).all();
  return {
    orderingEnabled: s.orderingEnabled === true && ready(s),
    items: rows.results.map(product),
    checkout: {
      version: s.version,
      termsSnapshot:
        s.termsVersion === legalPages.version ? legalSnapshot(s) : null,
      shippingMethods: s.shippingMethods,
      paymentMethods: s.paymentMethods,
      termsVersion: s.termsVersion,
      taxMode: s.taxMode,
      bankAccount: s.bankAccount,
    },
  };
}
function customerInput(input, addressRequired = false) {
  if (!input || typeof input !== "object")
    fail(422, "CUSTOMER_REQUIRED", "Vyplňte kontakt.");
  const c = {
    name: text(input.name, 120, true),
    email: email(input.email),
    phone: text(input.phone, 40),
    address: text(input.address, 200, addressRequired),
    city: text(input.city, 100, addressRequired),
    postalCode: text(input.postalCode, 20, addressRequired),
    country: text(input.country || "CZ", 2, true),
  };
  if (c.country !== "CZ")
    fail(422, "COUNTRY", "Pro tuto objednávku je dostupné doručení v ČR.");
  return c;
}
function customerStatement(env, c, id) {
  return stmt(
    env,
    "INSERT INTO customers(id,email,name,phone,created_at,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET updated_at=excluded.updated_at",
    id,
    c.email,
    c.name,
    c.phone,
    now(),
    now(),
  );
}
function outbox(env, type, id, c, template, payload) {
  return stmt(
    env,
    "INSERT INTO outbox(id,entity_type,entity_id,recipient,template,payload,created_at) VALUES(?,?,?,?,?,?,?)",
    uuid(),
    type,
    id,
    c.email,
    template,
    JSON.stringify(payload),
    now(),
  );
}
function reference(prefix) {
  return (
    "NFW-" +
    prefix +
    "-" +
    new Date().toISOString().slice(0, 10).replaceAll("-", "") +
    "-" +
    randomToken().slice(0, 10).toUpperCase()
  );
}
export async function enquiry(env, b, kind = "enquiry") {
  if (b.website) fail(422, "INVALID_INPUT", "Požadavek nelze přijmout.");
  const c = customerInput(b),
    id = uuid(),
    ref = reference(kind === "enquiry" ? "P" : "R");
  const source = ["contact", "gallery", "stock", "configurator"].includes(
    b.source,
  )
    ? b.source
    : "contact";
  const vehicle = text(b.vehicle, 300),
    message = text(b.message, 5000, kind !== "enquiry"),
    productRef = text(kind === "enquiry" ? b.reference : b.orderReference, 120);
  let config = b.configuration || {};
  if (typeof config === "string") config = { text: text(config, 12000) };
  if (
    !config ||
    Array.isArray(config) ||
    typeof config !== "object" ||
    JSON.stringify(config).length > 14000
  )
    fail(422, "CONFIG_TOO_LARGE", "Návrh je příliš dlouhý.");
  const t = now();
  await env.DB.batch([
    customerStatement(env, c, uuid()),
    stmt(
      env,
      "INSERT INTO enquiries(id,reference,customer_id,kind,source,vehicle,product_reference,message,configuration,created_at,updated_at,contact_snapshot) VALUES(?,?,(SELECT id FROM customers WHERE email=?),?,?,?,?,?,?,?,?,?)",
      id,
      ref,
      c.email,
      kind,
      source,
      vehicle,
      productRef,
      message,
      JSON.stringify(config),
      t,
      t,
      JSON.stringify(c),
    ),
    outbox(env, "enquiry", id, c, "enquiry_received", {
      reference: ref,
      kind,
      message,
    }),
    audit(env, "public", "created", "enquiry", id, { kind }),
  ]);
  return {
    id,
    reference: ref,
    status: "received",
    emailStatus: "blocked",
    message:
      "Požadavek jsme bezpečně zaevidovali. Uložte si jeho referenci. Automatické e-mailové potvrzení zatím není aktivní.",
  };
}
function checkoutInput(b, s) {
  if (b.termsAccepted !== true || b.termsVersion !== s.termsVersion)
    fail(422, "TERMS", "Potvrďte aktuální obchodní podmínky.");
  const shipping = s.shippingMethods.find((x) => x.id === b.shippingMethod);
  const payment = s.paymentMethods.find((x) => x.id === b.paymentMethod);
  if (!shipping || !payment)
    fail(422, "DELIVERY", "Vyberte dostupný způsob dopravy a platby.");
  const key = text(b.idempotencyKey, 100, true);
  if (!/^[a-zA-Z0-9_-]{16,100}$/.test(key))
    fail(422, "IDEMPOTENCY", "Obnovte stránku objednávky.");
  return { c: customerInput(b.customer, true), shipping, payment, key };
}
async function replay(env, key, requestHash) {
  const row = await stmt(
    env,
    "SELECT * FROM orders WHERE idempotency_key=?",
    key,
  ).first();
  if (!row) return null;
  if (row.request_hash !== requestHash)
    fail(
      409,
      "IDEMPOTENCY_CONFLICT",
      "Tento pokus již patří k jiné objednávce. Obnovte stránku.",
    );
  return receipt(row);
}
function receipt(row) {
  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    totalCents: row.total_cents,
    currency: row.currency,
    emailStatus: "blocked",
    message:
      "Objednávka je zaevidovaná. Uložte si její referenci. Automatické e-mailové potvrzení čeká na zprovoznění.",
  };
}
function orderInsert(
  env,
  {
    id,
    ref,
    c,
    kind,
    key,
    requestHash,
    shipping,
    payment,
    s,
    subtotal,
    specification = {},
  },
) {
  const t = now();
  return stmt(
    env,
    "INSERT INTO orders(id,reference,customer_id,kind,idempotency_key,request_hash,customer_snapshot,shipping_snapshot,payment_snapshot,specification,subtotal_cents,shipping_cents,total_cents,terms_version,tax_mode,terms_snapshot,accepted_at,created_at,updated_at) VALUES(?,?,(SELECT id FROM customers WHERE email=?),?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    id,
    ref,
    c.email,
    kind,
    key,
    requestHash,
    JSON.stringify(c),
    JSON.stringify(shipping),
    JSON.stringify({ ...payment, bankAccount: s.bankAccount }),
    JSON.stringify(specification),
    subtotal,
    shipping.priceCents,
    subtotal + shipping.priceCents,
    s.termsVersion,
    s.taxMode,
    JSON.stringify(specification.termsSnapshot || legalSnapshot(s)),
    t,
    t,
    t,
  );
}
export async function checkout(env, b) {
  const s = await settings(env);
  const input = checkoutInput(b, s);
  const requestHash = await hash(JSON.stringify(b));
  const existing = await replay(env, input.key, requestHash);
  if (existing) return existing;
  if (s.orderingEnabled !== true || !ready(s))
    fail(
      503,
      "ORDERING_DISABLED",
      "Přímé objednávky zatím nejsou spuštěné. Pošlete nám prosím poptávku.",
    );
  if (b.catalogVersion !== s.version)
    fail(
      409,
      "CATALOG_CHANGED",
      "Podmínky dopravy nebo platby se změnily. Obnovte souhrn objednávky.",
    );
  if (!Array.isArray(b.items) || b.items.length < 1 || b.items.length > 20)
    fail(422, "CART", "Košík musí obsahovat 1 až 20 položek.");
  const seen = new Set(),
    items = [];
  for (const item of b.items) {
    const id = text(item.productId, 80, true);
    if (seen.has(id))
      fail(422, "DUPLICATE_ITEM", "Košík obsahuje opakovanou položku.");
    seen.add(id);
    const quantity = integer(item.quantity, 1, 100);
    const row = await stmt(
      env,
      "SELECT * FROM products WHERE id=? AND published=1 AND confirmed=1",
      id,
    ).first();
    if (!row || !row.price_cents || row.on_hand - row.reserved < quantity)
      fail(
        409,
        "STOCK_CHANGED",
        "Některá sada již není dostupná v požadovaném množství.",
      );
    if (item.version !== row.version)
      fail(
        409,
        "PRODUCT_CHANGED",
        "Cena, specifikace nebo dostupnost se změnila. Obnovte souhrn objednávky.",
      );
    items.push({ row, quantity });
  }
  const subtotal = items.reduce(
    (n, x) => n + x.row.price_cents * x.quantity,
    0,
  );
  integer(subtotal, 1, 10000000000);
  const id = uuid(),
    ref = reference("O");
  const commands = [
    assertStatement(
      env,
      "(SELECT version FROM settings WHERE id=1)=?",
      s.version,
    ),
    customerStatement(env, input.c, uuid()),
    orderInsert(env, {
      ...input,
      id,
      ref,
      kind: "stock",
      requestHash,
      s,
      subtotal,
    }),
  ];
  for (const { row, quantity } of items)
    commands.push(
      assertStatement(
        env,
        "EXISTS(SELECT 1 FROM products WHERE id=? AND version=?)",
        row.id,
        row.version,
      ),
      stmt(
        env,
        "INSERT INTO order_items(id,order_id,product_id,quantity,unit_price_cents,snapshot) VALUES(?,?,?,?,?,?)",
        uuid(),
        id,
        row.id,
        quantity,
        row.price_cents,
        JSON.stringify(product(row)),
      ),
    );
  commands.push(
    outbox(env, "order", id, input.c, "order_received", {
      reference: ref,
      totalCents: subtotal + input.shipping.priceCents,
      currency: "CZK",
      termsVersion: s.termsVersion,
    }),
    audit(env, "public", "created", "order", id),
    stmt(env, "DELETE FROM assertions"),
  );
  try {
    await env.DB.batch(commands);
  } catch (error) {
    const duplicate = await replay(env, input.key, requestHash);
    if (duplicate) return duplicate;
    if (/STOCK_OR_PRICE_CHANGED|CHECK constraint/.test(error.message))
      fail(
        409,
        "STOCK_CHANGED",
        "Cena nebo dostupnost se změnila. Obnovte košík.",
      );
    throw error;
  }
  return receipt({
    id,
    reference: ref,
    status: "pending",
    total_cents: subtotal + input.shipping.priceCents,
    currency: "CZK",
  });
}
export function parseSettings(b, env) {
  const value = {
    orderingEnabled: b.orderingEnabled === true,
    offersEnabled: b.offersEnabled === true,
    legalReady: b.legalReady === true,
    taxMode: text(b.taxMode, 30, true),
    termsVersion: text(b.termsVersion, 40, true),
    bankAccount: text(b.bankAccount, 100),
    shippingMethods: [],
    paymentMethods: [],
  };
  if (!["unconfirmed", "vat_included", "non_vat_payer"].includes(value.taxMode))
    fail(422, "TAX_MODE", "Potvrďte daňový režim.");
  if (
    !Array.isArray(b.shippingMethods) ||
    b.shippingMethods.length > 10 ||
    !Array.isArray(b.paymentMethods) ||
    b.paymentMethods.length > 3
  )
    fail(422, "METHODS", "Neplatné způsoby dopravy nebo platby.");
  const ids = new Set();
  value.shippingMethods = b.shippingMethods.map((x) => {
    const id = text(x.id, 50, true);
    if (!/^[a-z0-9_-]+$/.test(id) || ids.has(id))
      fail(422, "SHIPPING_ID", "Doprava potřebuje jedinečné ID.");
    ids.add(id);
    return {
      id,
      label: text(x.label, 120, true),
      priceCents: integer(x.priceCents, 0, 1000000),
      deliveryText: text(x.deliveryText, 500, true),
    };
  });
  value.paymentMethods = b.paymentMethods.map((x) => {
    if (x.id !== "bank_transfer")
      fail(422, "PAYMENT", "Podporován je zatím bankovní převod.");
    return {
      id: "bank_transfer",
      label: text(x.label, 100, true),
      instructions: text(x.instructions, 1000, true),
    };
  });
  if (value.paymentMethods.length > 1)
    fail(422, "PAYMENT", "Zadejte převod pouze jednou.");
  if (
    (value.orderingEnabled || value.offersEnabled) &&
    !ready({
      ...value,
      confirmationReady: env.TRANSACTIONAL_CONFIRMATIONS_READY === "true",
    })
  )
    fail(
      422,
      "NOT_READY",
      "Nejprve potvrďte právní podmínky, daňový režim, účet, dopravu a platbu a zprovozněte trvalá potvrzení objednávek.",
    );
  if (value.termsVersion !== legalPages.version)
    fail(
      422,
      "TERMS_VERSION",
      "Verze musí odpovídat zveřejněným podmínkám: " + legalPages.version,
    );
  return value;
}
export async function createOffer(env, b, admin) {
  const s = await settings(env);
  if (!s.offersEnabled || !ready(s))
    fail(422, "OFFERS_DISABLED", "Před nabídkami potvrďte nastavení obchodu.");
  const enquiryId = text(b.enquiryId, 80, true),
    enq = await stmt(
      env,
      "SELECT * FROM enquiries WHERE id=?",
      enquiryId,
    ).first();
  if (!enq) fail(404, "NOT_FOUND", "Poptávka neexistuje.");
  const subtotal = integer(b.subtotalCents, 1, 1000000000),
    shipping = s.shippingMethods.find((x) => x.id === b.shippingMethod),
    payment = s.paymentMethods.find((x) => x.id === b.paymentMethod);
  if (!shipping || !payment) fail(422, "METHODS", "Vyberte dopravu a platbu.");
  const snapshot = {
    termsSnapshot: legalSnapshot(s),
    title: text(b.title, 200, true),
    specification: text(b.specification, 10000, true),
    subtotalCents: subtotal,
    shipping,
    payment: { ...payment, bankAccount: s.bankAccount },
    totalCents: subtotal + shipping.priceCents,
    currency: "CZK",
    deliveryText: text(b.deliveryText, 1000, true),
    termsVersion: s.termsVersion,
    taxMode: s.taxMode,
  };
  const token = randomToken(),
    id = uuid(),
    expires =
      Math.floor(Date.now() / 1000) + integer(b.validDays || 7, 1, 30) * 86400;
  await env.DB.batch([
    stmt(
      env,
      "INSERT INTO offers(id,enquiry_id,token_hash,snapshot,expires_at,created_at) VALUES(?,?,?,?,?,?)",
      id,
      enquiryId,
      await hash(token),
      JSON.stringify(snapshot),
      expires,
      now(),
    ),
    audit(env, admin.admin_id, "created", "offer", id, { enquiryId }),
  ]);
  return {
    id,
    link: (env.SITE_URL || "https://oarts.cz") + "/nabidka.html#token=" + token,
    expiresAt: expires,
    snapshot,
    emailStatus: "blocked",
  };
}
export async function viewOffer(env, b) {
  const token = text(b.token, 64, true);
  if (!/^[a-f0-9]{64}$/.test(token))
    fail(404, "NOT_FOUND", "Nabídka nebyla nalezena.");
  const row = await stmt(
    env,
    "SELECT id,snapshot,status,expires_at FROM offers WHERE token_hash=?",
    await hash(token),
  ).first();
  if (
    !row ||
    row.status === "revoked" ||
    row.expires_at < Math.floor(Date.now() / 1000)
  )
    fail(410, "EXPIRED", "Nabídka už není platná. Kontaktujte nás.");
  return {
    id: row.id,
    ...JSON.parse(row.snapshot),
    status: row.status,
    expiresAt: row.expires_at,
  };
}
export async function acceptOffer(env, b) {
  const s = await settings(env);
  if (!s.offersEnabled || !ready(s))
    fail(503, "OFFERS_DISABLED", "Příjem nabídek je pozastaven.");
  const token = text(b.token, 64, true),
    row = await stmt(
      env,
      "SELECT * FROM offers WHERE token_hash=?",
      await hash(token),
    ).first();
  if (
    !row ||
    row.expires_at < Math.floor(Date.now() / 1000) ||
    row.status === "revoked"
  )
    fail(410, "EXPIRED", "Nabídka není platná.");
  const snapshot = JSON.parse(row.snapshot);
  if (b.termsAccepted !== true || b.termsVersion !== snapshot.termsVersion)
    fail(
      422,
      "TERMS",
      "Potvrďte obchodní podmínky a objednávku s povinností platby.",
    );
  const c = customerInput(b.customer, true),
    key = text(b.idempotencyKey, 100, true);
  if (!/^[a-zA-Z0-9_-]{16,100}$/.test(key))
    fail(422, "IDEMPOTENCY", "Obnovte stránku.");
  const requestHash = await hash(JSON.stringify(b));
  const old = await replay(env, key, requestHash);
  if (old) return old;
  if (row.status !== "open")
    fail(409, "OFFER_USED", "Nabídka už byla přijata.");
  const id = uuid(),
    ref = reference("O");
  try {
    await env.DB.batch([
      assertStatement(
        env,
        "(SELECT status FROM offers WHERE id=?)='open' AND (SELECT version FROM settings WHERE id=1)=?",
        row.id,
        s.version,
      ),
      customerStatement(env, c, uuid()),
      orderInsert(env, {
        id,
        ref,
        c,
        kind: "custom",
        key,
        requestHash,
        shipping: snapshot.shipping,
        payment: snapshot.payment,
        s: {
          ...s,
          termsVersion: snapshot.termsVersion,
          taxMode: snapshot.taxMode,
          bankAccount: snapshot.payment.bankAccount,
        },
        subtotal: snapshot.subtotalCents,
        specification: snapshot,
      }),
      stmt(
        env,
        "UPDATE offers SET status='accepted',order_id=? WHERE id=?",
        id,
        row.id,
      ),
      outbox(env, "order", id, c, "order_received", {
        reference: ref,
        ...snapshot,
      }),
      audit(env, "public", "accepted", "offer", row.id, { orderId: id }),
      stmt(env, "DELETE FROM assertions"),
    ]);
  } catch (error) {
    const duplicate = await replay(env, key, requestHash);
    if (duplicate) return duplicate;
    if (/CHECK constraint/.test(error.message))
      fail(409, "OFFER_USED", "Nabídka se změnila nebo již byla přijata.");
    throw error;
  }
  return receipt({
    id,
    reference: ref,
    status: "pending",
    total_cents: snapshot.totalCents,
    currency: "CZK",
  });
}

function legalSnapshot(s) {
  if (s.termsVersion !== legalPages.version)
    fail(
      503,
      "TERMS_MISMATCH",
      "Podmínky obchodu se aktualizují. Zkuste to později.",
    );
  return {
    version: legalPages.version,
    company: legalPages.company,
    pages: legalPages.pages
      .filter((p) =>
        ["obchodni-podminky", "reklamacni-rad", "odstoupeni"].includes(p.id),
      )
      .map((p) => ({
        id: p.id,
        title: p.title,
        version: p.version,
        lead: p.lead,
        sections: p.sections,
        html: p.html,
      })),
  };
}
