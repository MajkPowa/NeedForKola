import { randomBytes, createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const folder = resolve("private");
await mkdir(folder, { recursive: true });
const token = randomBytes(32).toString("hex"),
  id = randomUUID(),
  hash = createHash("sha256").update(token).digest("hex");
const label = (process.argv[2] || "Majitel")
  .replaceAll("'", "''")
  .slice(0, 100);
const sql = `INSERT INTO admins(id,label,key_hash,created_at) VALUES('${id}','${label}','${hash}','${new Date().toISOString()}');\n`;
await writeFile(resolve(folder, "bootstrap-admin.sql"), sql, {
  mode: 0o600,
  flag: "wx",
});
await writeFile(
  resolve(folder, "owner-access.txt"),
  "NFW správa: https://oarts.cz/admin\nZáložní URL: https://nfw-commerce.largoverse-private.workers.dev/admin\nPřístupový klíč (uchovejte v trezoru):\n" +
    token +
    "\nAdmin ID: " +
    id +
    "\nSoubor není součástí publikovaného webu ani Git repozitáře.\n",
  { mode: 0o600, flag: "wx" },
);
console.log(
  "Bootstrap SQL a přístupový klíč byly bezpečně zapsány do commerce/private. Klíč se nevypisuje. Importujte SQL do správné D1 databáze.",
);
