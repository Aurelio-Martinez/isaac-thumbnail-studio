/**
 * Validates the verified wiki.gg artwork metadata catalog.
 *
 * Usage:
 *   npm run validate:assets
 *   npm run validate:assets -- --check-urls
 *
 * --check-urls samples direct wiki image URLs with HEAD requests. It never
 * downloads images. Some hosts block automated requests; those are warnings.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHECK_URLS = process.argv.includes("--check-urls");
const errors = [];
const warnings = [];
const checks = [];

function error(message) {
  errors.push(message);
}

function warn(message) {
  warnings.push(message);
}

function readJson(relativePath) {
  const full = path.join(ROOT, relativePath);
  if (!existsSync(full)) {
    error(`Missing file: ${relativePath}`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(full, "utf8"));
  } catch (caught) {
    error(`Invalid JSON in ${relativePath}: ${caught.message}`);
    return null;
  }
}

const ALLOWED_HOSTS = [
  { host: "bindingofisaacrebirth.wiki.gg", prefix: "/images/" },
  { host: "static.wikia.nocookie.net", prefix: "/bindingofisaacre_gamepedia/images/" },
];

function isAllowedRemote(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    return ALLOWED_HOSTS.some(
      (source) => source.host === url.hostname && url.pathname.startsWith(source.prefix),
    );
  } catch {
    return false;
  }
}

function checkCatalog() {
  const manifest = readJson("public/catalog/wikigg/manifest.json");
  const index = readJson("public/catalog/wikigg/index.json");
  if (!manifest || !index) return;
  if (manifest.schemaVersion !== 1) error("Catalog manifest schemaVersion must be 1.");
  if (!Array.isArray(index.assets)) {
    error("Catalog index has no assets array.");
    return;
  }
  const indexIds = new Set();
  for (const entry of index.assets) {
    if (indexIds.has(entry.id)) error(`Duplicate id in catalog index: ${entry.id}`);
    indexIds.add(entry.id);
    if (!isAllowedRemote(entry.imageUrl)) {
      error(`Catalog index entry ${entry.id} has a non-allowlisted image URL.`);
    }
    if (!isAllowedRemote(entry.thumbnailUrl)) {
      error(`Catalog index entry ${entry.id} has a non-allowlisted thumbnail URL.`);
    }
  }
  if (manifest.total !== index.assets.length) {
    error(`Catalog total mismatch: manifest ${manifest.total}, index ${index.assets.length}.`);
  }

  let categoryTotal = 0;
  const categories = manifest.categories ?? {};
  for (const [category, expectedCount] of Object.entries(categories)) {
    const payload = readJson(`public/catalog/wikigg/${category}.json`);
    if (!payload) continue;
    if (payload.category !== category) {
      error(`Catalog file ${category}.json declares category ${payload.category}.`);
    }
    if (!Array.isArray(payload.assets)) {
      error(`Catalog file ${category}.json has no assets array.`);
      continue;
    }
    if (payload.assets.length !== expectedCount) {
      error(
        `Catalog count mismatch for ${category}: manifest ${expectedCount}, file ${payload.assets.length}.`,
      );
    }
    categoryTotal += payload.assets.length;
    const ids = new Set();
    for (const entry of payload.assets) {
      if (ids.has(entry.id)) error(`Duplicate id in ${category}.json: ${entry.id}`);
      ids.add(entry.id);
      if (entry.category !== category) {
        error(`Entry ${entry.id} in ${category}.json has category ${entry.category}.`);
      }
      if (!isAllowedRemote(entry.imageUrl)) {
        error(`Entry ${entry.id} has an unsafe image URL.`);
      }
      if (!isAllowedRemote(entry.thumbnailUrl)) {
        error(`Entry ${entry.id} has an unsafe thumbnail URL.`);
      }
      if (!entry.sourceUrl?.startsWith("https://")) {
        error(`Entry ${entry.id} is missing an https source page.`);
      }
      if (!(entry.width > 0) || !(entry.height > 0)) {
        error(`Entry ${entry.id} has invalid dimensions.`);
      }
    }
  }

  if (existsSync(path.join(ROOT, "public", "media"))) {
    error("public/media still exists; bundled artwork should not be present.");
  }
  const unexpected = readdirSync(path.join(ROOT, "public", "catalog", "wikigg")).filter(
    (name) => !name.endsWith(".json") && !name.endsWith(".txt"),
  );
  if (unexpected.length > 0) {
    error(`Catalog folder contains non-metadata files: ${unexpected.join(", ")}`);
  }
  checks.push(
    `Catalog: ${index.assets.length} unique files across ${categoryTotal} category entries`,
  );
}

async function checkSomeUrls() {
  if (!CHECK_URLS) {
    checks.push("Remote URL sampling skipped (pass --check-urls to enable)");
    return;
  }
  const index = readJson("public/catalog/wikigg/index.json");
  if (!index) return;
  const samples = index.assets.slice(0, 6);
  for (const entry of samples) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(entry.imageUrl, {
        method: "HEAD",
        signal: controller.signal,
        headers: { "User-Agent": "IsaacThumbnailStudio/1.0 (catalog validation)" },
      });
      if (response.status === 403 || response.status === 429) {
        warn(`Host blocked HEAD sample ${entry.id} with HTTP ${response.status}.`);
      } else if (!response.ok) {
        warn(`Sample ${entry.id} returned HTTP ${response.status}.`);
      }
    } catch (caught) {
      warn(`Sample ${entry.id} could not be checked: ${caught.message}`);
    } finally {
      clearTimeout(timer);
    }
  }
  checks.push(`Remote URL samples: ${samples.length} checked`);
}

checkCatalog();
await checkSomeUrls();

for (const line of checks) console.log(`✓ ${line}`);
for (const line of warnings) console.warn(`! ${line}`);
for (const line of errors) console.error(`✗ ${line}`);

if (errors.length > 0) {
  console.error(`\nAsset validation failed with ${errors.length} error(s).`);
  process.exit(1);
}
console.log(
  `\nAsset validation passed${warnings.length ? ` with ${warnings.length} warning(s)` : ""}.`,
);
