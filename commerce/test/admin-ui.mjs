import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { readFile, readdir, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { randomBytes, createHash } from "node:crypto";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const origin = "https://admin-ui.invalid",
  token = randomBytes(32).toString("hex");
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
const mf = new Miniflare(
  convertV4MiniflareOptions({
    modules,
    compatibilityDate: "2026-10-04",
    compatibilityFlags: ["nodejs_compat"],
    d1Databases: ["DB"],
    bindings: {
      ENVIRONMENT: "test",
      SECURITY_SECRET: randomBytes(32).toString("hex"),
      SITE_URL: origin,
      ALLOWED_ORIGINS: origin,
      TRANSACTIONAL_CONFIRMATIONS_READY: "false",
    },
  }),
);
let browser;
try {
  const db = await mf.getD1Database("DB");
  for (const f of (await readdir("migrations")).sort()) {
    const migration = await readFile("migrations/" + f, "utf8");
    for (const sql of migration
      .split(/(?=^(?:CREATE|INSERT|ALTER|PRAGMA))/m)
      .filter((x) => x.trim()))
      await db.prepare(sql).run();
  }
  await db
    .prepare("INSERT INTO admins(id,label,key_hash,created_at) VALUES(?,?,?,?)")
    .bind(
      "browser-admin",
      "Test obsluha",
      createHash("sha256").update(token).digest("hex"),
      new Date().toISOString(),
    )
    .run();
  browser = await chromium.launch({ headless: true, channel: "chrome" });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await context.route(origin + "/**", async (route) => {
    const req = route.request();
    if (req.url().endsWith("/favicon.ico"))
      return route.fulfill({ status: 204, body: "" });
    const response = await mf.dispatchFetch(req.url(), {
      method: req.method(),
      headers: req.headers(),
      body: ["GET", "HEAD"].includes(req.method()) ? undefined : req.postData(),
    });
    await route.fulfill({
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: Buffer.from(await response.arrayBuffer()),
    });
  });
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin + "/admin");
  assert.equal(await page.locator("#loginForm").getAttribute("method"), "post");
  await page.waitForFunction(
    () => !document.getElementById("loginSubmit").disabled,
  );
  await page.locator("input[name=token]").fill(token);
  await page.locator("#loginSubmit").click();
  await page.locator("#workspace").waitFor({ state: "visible" });
  await page.waitForFunction(
    () => document.getElementById("identity").textContent === "Test obsluha",
  );
  assert.equal(
    (await db.prepare("SELECT count(*) n FROM sessions").first()).n,
    1,
  );
  assert.ok(!page.url().includes(token));
  await page.locator("[data-tab=products]").click();
  await page.getByRole("button", { name: "+ Přidat sadu" }).click();
  await page.locator("#editor").waitFor({ state: "visible" });
  await page.locator("#editor input[name=sku]").fill("BROWSER-TEST");
  await page.locator("#editor input[name=title]").fill("Pouze lokální test");
  await page.getByRole("button", { name: "Uložit", exact: true }).click();
  await page.locator("#editor").waitFor({ state: "hidden" });
  assert.equal(
    (await db.prepare("SELECT count(*) n FROM products").first()).n,
    1,
  );
  assert.equal(
    (await db.prepare("SELECT on_hand,published FROM products").first())
      .on_hand,
    0,
  );
  await page.getByRole("button", { name: "Upravit", exact: true }).click();
  await page.locator("#editor").waitFor({ state: "visible" });
  // Expiry during an open private editor must close it and clear the workspace.
  await db.prepare("DELETE FROM sessions").run();
  await page.evaluate(() => document.getElementById("refresh").click());
  await page.locator("#login").waitFor({ state: "visible" });
  assert.equal(await page.locator("#editor").evaluate((x) => x.open), false);
  assert.equal(await page.locator("#editorBody").textContent(), "");
  assert.equal(await page.locator("#content").textContent(), "");
  assert.equal(await page.locator("#identity").textContent(), "");
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  const out = resolve("../tools/.cache-launch/admin-ui");
  await mkdir(out, { recursive: true });
  await page.screenshot({
    path: resolve(out, "login-mobile.png"),
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  const nojs = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  await nojs.route(origin + "/**", async (route) => {
    const req = route.request();
    if (req.url().endsWith("/favicon.ico"))
      return route.fulfill({ status: 204, body: "" });
    const r = await mf.dispatchFetch(req.url());
    await route.fulfill({
      status: r.status,
      headers: Object.fromEntries(r.headers),
      body: Buffer.from(await r.arrayBuffer()),
    });
  });
  const fallback = await nojs.newPage();
  await fallback.goto(origin + "/admin");
  assert.equal(await fallback.locator("#loginSubmit").isDisabled(), true);
  assert.equal(
    await fallback.locator("#loginForm").getAttribute("method"),
    "post",
  );
  console.log(
    "PASS admin mobile UI: actual local authentication, secure session, private product save, expiry clears data/dialog, no JavaScript fallback blocks submit and never uses GET.",
  );
} finally {
  await browser?.close();
  await mf.dispose();
}
