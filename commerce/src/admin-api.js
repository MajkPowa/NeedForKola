import {
  body,
  fail,
  text,
  integer,
  hash,
  randomToken,
  now,
  uuid,
  rate,
  checkWrite,
  session,
  cookie,
  adminCookie,
  clearCookie,
  stmt,
  audit,
  assertStatement,
} from "./security.js";
import { settings, parseSettings, createOffer } from "./commerce.js";
const safeSpecs = (value) => {
  if (!Array.isArray(value) || value.length > 30)
    fail(422, "SPECS", "Specifikace musí být seznam nejvýše 30 údajů.");
  return value.map((x) => ({
    label: text(x.label, 80, true),
    value: text(x.value, 400, true),
  }));
};
export async function adminRoute(request, env, path) {
  const method = request.method;
  if (path === "/api/admin/login" && method === "POST") {
    checkWrite(request, env, true);
    await rate(request, env, "login", 6, 900);
    const b = await body(request, 2048),
      key = text(b.token, 128, true);
    const row = await stmt(
      env,
      "SELECT id,label FROM admins WHERE key_hash=? AND enabled=1",
      await hash(key),
    ).first();
    if (!row) fail(401, "LOGIN_FAILED", "Přístupový klíč není platný.");
    const token = randomToken(),
      csrf = randomToken();
    await env.DB.batch([
      stmt(
        env,
        "INSERT INTO sessions(hash,admin_id,csrf,expires_at) VALUES(?,?,?,?)",
        await hash(token),
        row.id,
        csrf,
        Math.floor(Date.now() / 1000) + 28800,
      ),
      stmt(
        env,
        "DELETE FROM sessions WHERE expires_at<?",
        Math.floor(Date.now() / 1000),
      ),
      stmt(
        env,
        "DELETE FROM rate_limits WHERE expires_at<?",
        Math.floor(Date.now() / 1000),
      ),
      audit(env, row.id, "login", "admin", row.id),
    ]);
    return {
      data: { ok: true, csrf, label: row.label },
      cookie: adminCookie(token),
    };
  }
  const admin = await session(request, env, !["GET", "HEAD"].includes(method));
  if (path === "/api/admin/session" && method === "GET")
    return {
      data: {
        csrf: admin.csrf,
        label: admin.label,
        expiresAt: admin.expires_at,
      },
    };
  if (path === "/api/admin/logout" && method === "POST") {
    await stmt(
      env,
      "DELETE FROM sessions WHERE hash=?",
      await hash(cookie(request)),
    ).run();
    return { data: { ok: true }, cookie: clearCookie };
  }
  if (path === "/api/admin/overview" && method === "GET") {
    const result = await env.DB.batch([
      stmt(env, "SELECT count(*) AS count FROM enquiries WHERE status='new'"),
      stmt(env, "SELECT count(*) AS count FROM orders WHERE status='pending'"),
      stmt(env, "SELECT count(*) AS count FROM outbox WHERE status<>'sent'"),
      stmt(env, "SELECT count(*) AS count FROM products"),
      stmt(env, "SELECT count(*) AS count FROM customers"),
    ]);
    return {
      data: {
        newEnquiries: result[0].results[0].count,
        pendingOrders: result[1].results[0].count,
        blockedEmails: result[2].results[0].count,
        products: result[3].results[0].count,
        customers: result[4].results[0].count,
        emailConfigured: false,
      },
    };
  }
  if (path === "/api/admin/settings") {
    if (method === "GET") return { data: await settings(env) };
    if (method === "PUT") {
      const b = await body(request);
      const value = parseSettings(b, env);
      const version = integer(b.version, 1, 100000000);
      await env.DB.batch([
        assertStatement(
          env,
          "(SELECT version FROM settings WHERE id=1)=?",
          version,
        ),
        stmt(
          env,
          "UPDATE settings SET value=?,version=version+1 WHERE id=1",
          JSON.stringify(value),
        ),
        audit(env, admin.admin_id, "updated", "settings", "1", {
          orderingEnabled: value.orderingEnabled,
          offersEnabled: value.offersEnabled,
        }),
        stmt(env, "DELETE FROM assertions"),
      ]);
      return { data: { ...value, version: version + 1 } };
    }
  }
  if (path === "/api/admin/products" && method === "GET") {
    const rows = await stmt(
      env,
      "SELECT * FROM products ORDER BY updated_at DESC LIMIT 500",
    ).all();
    return {
      data: {
        items: rows.results.map((x) => ({ ...x, specs: JSON.parse(x.specs) })),
      },
    };
  }
  const productMatch = path.match(
    /^\/api\/admin\/products\/([a-zA-Z0-9_-]{1,80})$/,
  );
  if (productMatch && method === "PUT") {
    const id = productMatch[1],
      b = await body(request);
    const sku = text(b.sku, 80, true),
      title = text(b.title, 200, true),
      description = text(b.description, 4000),
      specs = safeSpecs(b.specs || []),
      image = text(b.image, 300);
    if (
      image &&
      !/^assets\/(?:real-wheels|stock)\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.(?:webp|jpe?g|png)$/i.test(
        image,
      )
    )
      fail(
        422,
        "IMAGE",
        "Fotografie musí být lokální podklad skutečného kola.",
      );
    const price =
        b.priceCents === null || b.priceCents === undefined
          ? null
          : integer(b.priceCents, 1, 1000000000),
      wheels = integer(b.wheelsPerSet ?? 4, 1, 8),
      confirmed = b.confirmed === true ? 1 : 0,
      published = b.published === true ? 1 : 0;
    if (published && (!confirmed || !price || !image || !specs.length))
      fail(
        422,
        "UNCONFIRMED_PRODUCT",
        "Před zveřejněním potvrďte cenu za sadu, fotografii a specifikaci.",
      );
    const existing = await stmt(
      env,
      "SELECT version FROM products WHERE id=?",
      id,
    ).first();
    const cmds = [];
    if (existing) {
      integer(b.version, 1, 100000000);
      cmds.push(
        assertStatement(
          env,
          "(SELECT version FROM products WHERE id=?)=?",
          id,
          b.version,
        ),
        stmt(
          env,
          "UPDATE products SET sku=?,title=?,description=?,specs=?,image=?,price_cents=?,wheels_per_set=?,confirmed=?,published=?,version=version+1,updated_at=? WHERE id=?",
          sku,
          title,
          description,
          JSON.stringify(specs),
          image,
          price,
          wheels,
          confirmed,
          published,
          now(),
          id,
        ),
      );
    } else {
      cmds.push(
        stmt(
          env,
          "INSERT INTO products(id,sku,title,description,specs,image,price_cents,wheels_per_set,confirmed,published,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
          id,
          sku,
          title,
          description,
          JSON.stringify(specs),
          image,
          price,
          wheels,
          confirmed,
          published,
          now(),
          now(),
        ),
      );
    }
    cmds.push(
      audit(
        env,
        admin.admin_id,
        existing ? "updated" : "created",
        "product",
        id,
        { published, confirmed, priceCents: price },
      ),
      stmt(env, "DELETE FROM assertions"),
    );
    await env.DB.batch(cmds);
    return { data: { ok: true, id } };
  }
  const movementMatch = path.match(
    /^\/api\/admin\/products\/([a-zA-Z0-9_-]{1,80})\/movements$/,
  );
  if (movementMatch && method === "POST") {
    const id = movementMatch[1],
      b = await body(request, 4000),
      delta = integer(b.delta, -10000, 10000),
      reason = text(b.reason, 500, true);
    if (delta === 0) fail(422, "ZERO_MOVEMENT", "Pohyb musí změnit množství.");
    const row = await stmt(
      env,
      "SELECT * FROM products WHERE id=?",
      id,
    ).first();
    if (!row) fail(404, "NOT_FOUND", "Produkt neexistuje.");
    await env.DB.batch([
      assertStatement(
        env,
        "EXISTS(SELECT 1 FROM products WHERE id=? AND version=? AND on_hand+?>=reserved)",
        id,
        integer(b.version, 1, 100000000),
        delta,
      ),
      stmt(
        env,
        "UPDATE products SET on_hand=on_hand+?,version=version+1,updated_at=? WHERE id=?",
        delta,
        now(),
        id,
      ),
      stmt(
        env,
        "INSERT INTO stock_movements(id,product_id,kind,delta_on_hand,reason,actor,created_at) VALUES(?,?,?,?,?,?,?)",
        uuid(),
        id,
        delta > 0 ? "receipt" : "adjustment",
        delta,
        reason,
        admin.admin_id,
        now(),
      ),
      audit(env, admin.admin_id, "stock_movement", "product", id, {
        delta,
        reason,
      }),
      stmt(env, "DELETE FROM assertions"),
    ]);
    return { data: { ok: true } };
  }
  if (path === "/api/admin/enquiries" && method === "GET") {
    const rows = await stmt(
      env,
      "SELECT e.*,coalesce(json_extract(e.contact_snapshot,'$.name'),c.name) AS name,coalesce(json_extract(e.contact_snapshot,'$.email'),c.email) AS email,coalesce(json_extract(e.contact_snapshot,'$.phone'),c.phone) AS phone FROM enquiries e JOIN customers c ON c.id=e.customer_id ORDER BY e.created_at DESC LIMIT 200",
    ).all();
    return {
      data: {
        items: rows.results.map((x) => ({
          ...x,
          configuration: JSON.parse(x.configuration),
        })),
      },
    };
  }
  if (path === "/api/admin/customers" && method === "GET") {
    const rows = await stmt(
      env,
      "SELECT * FROM customers ORDER BY updated_at DESC LIMIT 200",
    ).all();
    return { data: { items: rows.results } };
  }
  if (path === "/api/admin/orders" && method === "GET") {
    const rows = await stmt(
      env,
      "SELECT * FROM orders ORDER BY created_at DESC LIMIT 200",
    ).all();
    return {
      data: {
        items: rows.results.map((x) => ({
          ...x,
          customer_snapshot: JSON.parse(x.customer_snapshot),
          shipping_snapshot: JSON.parse(x.shipping_snapshot),
          payment_snapshot: JSON.parse(x.payment_snapshot),
          specification: JSON.parse(x.specification),
        })),
      },
    };
  }
  if (path === "/api/admin/movements" && method === "GET")
    return {
      data: {
        items: (
          await stmt(
            env,
            "SELECT m.*,p.sku FROM stock_movements m JOIN products p ON p.id=m.product_id ORDER BY m.created_at DESC LIMIT 300",
          ).all()
        ).results,
      },
    };
  if (path === "/api/admin/outbox" && method === "GET")
    return {
      data: {
        items: (
          await stmt(
            env,
            "SELECT id,entity_type,entity_id,recipient,template,status,attempts,created_at,sent_at,last_error FROM outbox ORDER BY created_at DESC LIMIT 200",
          ).all()
        ).results,
        emailConfigured: false,
      },
    };
  if (path === "/api/admin/audit" && method === "GET")
    return {
      data: {
        items: (
          await stmt(
            env,
            "SELECT * FROM audit ORDER BY created_at DESC LIMIT 300",
          ).all()
        ).results,
      },
    };
  const statusMatch = path.match(
    /^\/api\/admin\/(orders|enquiries)\/([a-zA-Z0-9_-]{1,80})\/status$/,
  );
  if (statusMatch && method === "POST") {
    const [, type, id] = statusMatch,
      b = await body(request, 4000),
      status = text(b.status, 30, true),
      reason = text(b.reason, 1000, true);
    if (type === "enquiries") {
      if (!["new", "contacted", "quoted", "closed"].includes(status))
        fail(422, "STATUS", "Neplatný stav.");
      const r = await stmt(
        env,
        "SELECT id FROM enquiries WHERE id=?",
        id,
      ).first();
      if (!r) fail(404, "NOT_FOUND", "Záznam neexistuje.");
      await env.DB.batch([
        stmt(
          env,
          "UPDATE enquiries SET status=?,updated_at=? WHERE id=?",
          status,
          now(),
          id,
        ),
        audit(env, admin.admin_id, "status_changed", "enquiry", id, {
          status,
          reason,
        }),
      ]);
    } else {
      if (!["paid", "fulfilled", "cancelled", "closed"].includes(status))
        fail(422, "STATUS", "Neplatný stav objednávky.");
      const version = integer(b.version, 1, 100000000);
      await env.DB.batch([
        assertStatement(
          env,
          "EXISTS(SELECT 1 FROM orders WHERE id=? AND version=?)",
          id,
          version,
        ),
        stmt(
          env,
          "UPDATE orders SET status=?,updated_at=?,version=version+1 WHERE id=?",
          status,
          now(),
          id,
        ),
        audit(env, admin.admin_id, "status_changed", "order", id, {
          status,
          reason,
        }),
        stmt(env, "DELETE FROM assertions"),
      ]);
    }
    return { data: { ok: true } };
  }
  if (path === "/api/admin/notes" && method === "POST") {
    const b = await body(request, 6000);
    if (!["enquiry", "order", "customer"].includes(b.entityType))
      fail(422, "ENTITY", "Neplatný typ záznamu.");
    const id = text(b.entityId, 80, true),
      note = text(b.body, 5000, true),
      table = { enquiry: "enquiries", order: "orders", customer: "customers" }[
        b.entityType
      ];
    if (
      !(await stmt(env, "SELECT id FROM " + table + " WHERE id=?", id).first())
    )
      fail(404, "NOT_FOUND", "Záznam neexistuje.");
    await env.DB.batch([
      stmt(
        env,
        "INSERT INTO notes(id,entity_type,entity_id,body,actor,created_at) VALUES(?,?,?,?,?,?)",
        uuid(),
        b.entityType,
        id,
        note,
        admin.admin_id,
        now(),
      ),
      audit(env, admin.admin_id, "note_added", b.entityType, id),
      ...(b.entityType === "enquiry"
        ? [stmt(env, "UPDATE enquiries SET updated_at=? WHERE id=?", now(), id)]
        : []),
    ]);
    return { data: { ok: true } };
  }
  if (path === "/api/admin/notes" && method === "GET") {
    const u = new URL(request.url),
      id = text(u.searchParams.get("id"), 80, true),
      type = text(u.searchParams.get("type"), 20, true);
    return {
      data: {
        items: (
          await stmt(
            env,
            "SELECT * FROM notes WHERE entity_id=? AND entity_type=? ORDER BY created_at",
            id,
            type,
          ).all()
        ).results,
      },
    };
  }
  if (path === "/api/admin/offers" && method === "POST")
    return { data: await createOffer(env, await body(request), admin) };
  if (path === "/api/admin/offers" && method === "GET")
    return {
      data: {
        items: (
          await stmt(
            env,
            "SELECT id,enquiry_id,snapshot,expires_at,status,order_id,created_at FROM offers ORDER BY created_at DESC LIMIT 200",
          ).all()
        ).results.map((x) => ({ ...x, snapshot: JSON.parse(x.snapshot) })),
      },
    };
  const revoke = path.match(
    /^\/api\/admin\/offers\/([a-zA-Z0-9_-]{1,80})\/revoke$/,
  );
  if (revoke && method === "POST") {
    await env.DB.batch([
      assertStatement(
        env,
        "EXISTS(SELECT 1 FROM offers WHERE id=? AND status='open')",
        revoke[1],
      ),
      stmt(env, "UPDATE offers SET status='revoked' WHERE id=?", revoke[1]),
      audit(env, admin.admin_id, "revoked", "offer", revoke[1]),
      stmt(env, "DELETE FROM assertions"),
    ]);
    return { data: { ok: true } };
  }
  fail(404, "NOT_FOUND", "Požadovaná funkce neexistuje.");
}
