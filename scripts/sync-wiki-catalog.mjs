/**
 * Builds a metadata-only snapshot of verified wiki.gg artwork.
 *
 * - NO IMAGE FILES ARE DOWNLOADED OR REDISTRIBUTED.
 * - Only names, dimensions, direct file URLs, and source page URLs are stored.
 * - Images are streamed at runtime through the allowlisted /api/asset-proxy.
 * - Every entry points at its wiki file page for attribution and licensing.
 *
 * The snapshot keeps the library instantly searchable even when the live
 * MediaWiki API is unavailable. A live provider remains available as well.
 *
 * Run with: npm run sync:catalog
 */
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public", "catalog", "wikigg");
const API = "https://bindingofisaacrebirth.wiki.gg/api.php";
const SOURCE_NAME = "The Binding of Isaac: Rebirth Wiki (wiki.gg)";
const FILE_BASE = "https://bindingofisaacrebirth.wiki.gg/wiki/";
const REQUEST_DELAY_MS = 1200;
const USER_AGENT = "IsaacThumbnailStudio/1.0 (metadata catalog sync; no image downloads)";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function humanize(title) {
  let base = title.replace(/^File:/i, "").replace(/\.(png|webp|jpe?g|gif)$/i, "");
  base = base.replace(/^(Character|Collectible|Trinket|Pickup|Boss|Stage)\s+/i, "");
  base = base.replace(/\s+(icon|portrait)$/i, "");
  base = base.replace(/\s+appearance$/i, "");
  base = base.replace(/\s+room$/i, "");
  base = base.replace(/_/g, " ").replace(/\s+/g, " ").trim();
  return base;
}

function hash(value) {
  let result = 0;
  for (let i = 0; i < value.length; i += 1) {
    result = (result * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(result);
}

let requestCount = 0;

async function api(params) {
  const url = new URL(API);
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  url.searchParams.set("origin", "*");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    requestCount += 1;
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      });
      if (response.status === 429 || response.status === 403 || response.status >= 500) {
        const wait = 5000 * (attempt + 1);
        console.warn(`  HTTP ${response.status}; retrying in ${wait / 1000}s…`);
        await sleep(wait);
        continue;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
      const json = await response.json();
      if (json.error) throw new Error(`API error: ${json.error.info ?? json.error.code}`);
      if (!json.query) throw new Error("API response did not include query data");
      await sleep(REQUEST_DELAY_MS);
      return json;
    } catch (error) {
      if (attempt === 3) throw error;
      console.warn(`  ${error.message}; retrying…`);
      await sleep(3000 * (attempt + 1));
    }
  }
  throw new Error("API request failed after retries");
}

function pageToEntry(page, category, nameOverride) {
  const info = page.imageinfo?.[0];
  if (!info?.url || !info.width || !info.height) return null;
  const mime = info.mime ?? "image/png";
  if (!["image/png", "image/webp", "image/jpeg"].includes(mime)) return null;
  if (info.width < 8 || info.height < 8) return null;
  const title = page.title ?? "";
  const name = nameOverride ?? humanize(title);
  if (!name) return null;
  return {
    id: `wikigg-file-${page.pageid ?? Math.abs(hash(title))}`,
    name,
    category,
    imageUrl: info.url,
    thumbnailUrl: info.thumburl || info.url,
    sourceUrl: info.descriptionurl || `${FILE_BASE}${encodeURIComponent(title)}`,
    width: info.width,
    height: info.height,
    mime,
  };
}

async function collectPages(params) {
  const pages = [];
  let cursor;
  for (let page = 0; page < 30; page += 1) {
    const data = await api({ ...params, ...cursor });
    pages.push(...(data.query?.pages ?? []));
    cursor = data.continue;
    if (!cursor) break;
  }
  return pages;
}

const FILTERS = {
  characters: {
    category: "Character images",
    accept: (title) => /^File:Character .+\.(?:png|webp)$/i.test(title),
  },
  collectibles: {
    category: "Collectible icons",
    accept: (title) => {
      if (!/^File:Collectible .+ icon\.(?:png|webp)$/i.test(title)) return false;
      const item = /^File:Collectible (.+) icon\.(?:png|webp)$/i.exec(title)?.[1] ?? "";
      return !/\b(Afterbirth|Rebirth|Repentance|Antibirth)\+?$/i.test(item);
    },
  },
  trinkets: {
    category: "Trinket icons",
    accept: (title) => {
      if (!/^File:Trinket .+ icon\.(?:png|webp)$/i.test(title)) return false;
      return !/\bOld$/i.test(title.replace(/\.(png|webp)$/i, ""));
    },
  },
  cards: {
    category: "Card icons",
    accept: (title) => /^File:Pickup .+\.(?:png|webp)$/i.test(title),
  },
  pills: {
    category: "Pill icons",
    accept: (title) => /^File:.+\.(?:png|webp)$/i.test(title),
  },
  bosses: {
    category: "Boss images",
    accept: (title) => /^File:.+\.(?:png|webp)$/i.test(title),
  },
  backgrounds: {
    category: "Starting room images",
    accept: (title) => /^File:.+\.(?:png|webp)$/i.test(title),
  },
};

async function collectCategory(key) {
  const filter = FILTERS[key];
  const width = key === "backgrounds" ? 640 : 256;
  console.log(`Fetching ${filter.category}…`);
  const pages = await collectPages({
    generator: "categorymembers",
    gcmtitle: `Category:${filter.category}`,
    gcmtype: "file",
    gcmlimit: "500",
    prop: "imageinfo",
    iiprop: "url|size|mime",
    iiurlwidth: String(width),
  });
  const entries = pages
    .filter((page) => filter.accept(page.title ?? ""))
    .map((page) => pageToEntry(page, key))
    .filter(Boolean);
  const unique = new Map(entries.map((entry) => [entry.id, entry]));
  const sorted = [...unique.values()].sort((a, b) => a.name.localeCompare(b.name));
  console.log(`  ${sorted.length} files kept`);
  return sorted;
}

async function collectActiveItems() {
  console.log("Fetching Activated collectibles page list…");
  const pages = [];
  let cursor;
  for (let page = 0; page < 5; page += 1) {
    const data = await api({
      list: "categorymembers",
      cmtitle: "Category:Activated collectibles",
      cmtype: "page",
      cmlimit: "500",
      ...cursor,
    });
    pages.push(...(data.query?.categorymembers ?? []));
    cursor = data.continue;
    if (!cursor) break;
  }
  console.log(`  ${pages.length} activated collectibles`);
  const entries = [];
  for (let i = 0; i < pages.length; i += 40) {
    const chunk = pages.slice(i, i + 40);
    const data = await api({
      titles: chunk.map((page) => `File:Collectible ${page.title} icon.png`).join("|"),
      prop: "imageinfo",
      iiprop: "url|size|mime",
      iiurlwidth: "256",
    });
    for (const filePage of data.query?.pages ?? []) {
      if (filePage.missing) continue;
      const itemName = /^File:Collectible (.+) icon\.png$/i.exec(filePage.title ?? "")?.[1];
      const entry = pageToEntry(
        filePage,
        "active-items",
        itemName ?? humanize(filePage.title ?? ""),
      );
      if (entry) entries.push(entry);
    }
    console.log(`  resolved ${Math.min(i + 40, pages.length)} / ${pages.length}`);
  }
  const unique = new Map(entries.map((entry) => [entry.id, entry]));
  return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name));
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const catalog = {};
  const counts = {};

  for (const key of Object.keys(FILTERS)) {
    const entries = await collectCategory(key);
    catalog[key] = entries;
    counts[key] = entries.length;
  }

  const active = await collectActiveItems();
  catalog["active-items"] = active;
  counts["active-items"] = active.length;

  // Search index: one entry per file id. Active items win on duplicate IDs so
  // search surfaces the more specific category.
  const index = new Map();
  for (const category of Object.keys(catalog)) {
    for (const entry of catalog[category]) {
      if (category === "active-items" || !index.has(entry.id)) {
        index.set(entry.id, entry);
      }
    }
  }
  const sortedIndex = [...index.values()].sort((a, b) => a.name.localeCompare(b.name));

  for (const [category, entries] of Object.entries(catalog)) {
    await writeFile(
      path.join(OUT, `${category}.json`),
      `${JSON.stringify({ schemaVersion: 1, category, generatedAt: new Date().toISOString(), assets: entries }, null, 0)}\n`,
      "utf8",
    );
  }

  await writeFile(
    path.join(OUT, "index.json"),
    `${JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), assets: sortedIndex }, null, 0)}\n`,
    "utf8",
  );

  const manifest = {
    schemaVersion: 1,
    providerId: "wikigg",
    sourceName: SOURCE_NAME,
    api: API,
    site: "https://bindingofisaacrebirth.wiki.gg",
    generatedAt: new Date().toISOString(),
    imagePolicy:
      "Metadata only. No image files are stored in this repository. Images are streamed from the wiki at runtime through an allowlisted proxy.",
    license:
      "Game artwork © Nicalis, Inc. / Edmund McMillen. Wiki files are marked IN COPYRIGHT (Template:License/game). Verify before publishing.",
    categories: counts,
    total: sortedIndex.length,
    requests: requestCount,
  };
  await writeFile(
    path.join(OUT, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    path.join(OUT, "ATTRIBUTION.txt"),
    `Artwork metadata source: ${SOURCE_NAME}\n${API}\n\nThis directory contains only factual file metadata (titles, dimensions,\ndirect file URLs, and source page URLs). No image data is redistributed.\n\nGame artwork is © Nicalis, Inc. / Edmund McMillen. Files on the wiki are\nmarked IN COPYRIGHT. Each asset links to its source page for attribution.\n\nGenerated: ${manifest.generatedAt}\n`,
    "utf8",
  );

  console.log("\nCatalog complete:", counts, "total unique:", sortedIndex.length);
  console.log(`Requests used: ${requestCount}`);
}

await main();
