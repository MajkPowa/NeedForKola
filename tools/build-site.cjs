"use strict";
// Copy only public website files. Operational code, secrets and customer data never enter the asset bundle.
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const output = path.resolve(root, "commerce", "public");
if (
  output !== path.join(root, "commerce", "public") ||
  !output.startsWith(root + path.sep)
)
  throw new Error("Unsafe output directory");
fs.mkdirSync(output, { recursive: true });
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
let count = 0,
  bytes = 0;
function copy(relative) {
  const source = path.join(root, relative),
    target = path.join(output, relative);
  if (fs.lstatSync(source).isSymbolicLink())
    throw new Error("Symlinks are not public assets: " + relative);
  if (fs.statSync(source).isDirectory()) {
    for (const name of fs.readdirSync(source)) copy(path.join(relative, name));
    return;
  }
  if (/^(desktop\.ini|Thumbs\.db|\.DS_Store)$/i.test(path.basename(relative)))
    return;
  const stat = fs.statSync(source);
  if (stat.size > 25 * 1024 * 1024)
    throw new Error("Asset exceeds platform limit: " + relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  count++;
  bytes += stat.size;
}
for (const directory of ["assets", "css", "js"]) copy(directory);
for (const name of fs.readdirSync(root))
  if (
    /\.html$/.test(name) ||
    ["robots.txt", "sitemap.xml", "_headers"].includes(name)
  )
    copy(name);
for (const name of fs.readdirSync(path.join(root, "data")))
  if (/\.json$/.test(name)) copy(path.join("data", name));
for (const name of [
  "real-wheels-register.md",
  "vehicle-visuals.md",
  "vehicle-catalog.md",
  "3d-assets.md",
  "brand-logos.md",
  "media-sources.md",
]) {
  const relative = path.join("docs", name);
  if (fs.existsSync(path.join(root, relative))) copy(relative);
}
console.log(
  JSON.stringify({
    output,
    files: count,
    megabytes: +(bytes / 1024 / 1024).toFixed(2),
  }),
);
