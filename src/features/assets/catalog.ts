import { z } from "zod";
import type { Asset } from "@/features/assets/types";
import { ASSET_CATEGORIES } from "@/features/assets/types";
import { AssetSourceError } from "@/features/assets/search";
import { withBasePath } from "@/features/assets/resolve";
import { isAllowedAssetUrl } from "../../../shared/assetSources";

const httpUrl = z
  .string()
  .max(2048)
  .refine((value) => value.startsWith("https://"), "Expected an https URL.");

export const catalogEntrySchema = z.object({
  id: z.string().min(1).max(160),
  name: z.string().min(1).max(200),
  category: z.enum(ASSET_CATEGORIES),
  imageUrl: httpUrl.refine(isAllowedAssetUrl, "Image URL is not on an allowlisted wiki host."),
  thumbnailUrl: httpUrl.refine(
    isAllowedAssetUrl,
    "Thumbnail URL is not on an allowlisted wiki host.",
  ),
  sourceUrl: httpUrl,
  width: z.number().int().min(8).max(20_000),
  height: z.number().int().min(8).max(20_000),
  mime: z.string().max(80).optional(),
});

export type CatalogEntry = z.infer<typeof catalogEntrySchema>;

const catalogFileSchema = z.object({
  schemaVersion: z.literal(1),
  category: z.enum(ASSET_CATEGORIES),
  generatedAt: z.string(),
  assets: z.array(catalogEntrySchema),
});

const catalogIndexSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string(),
  assets: z.array(catalogEntrySchema),
});

export type CatalogCategory = Exclude<(typeof ASSET_CATEGORIES)[number], "uploads">;

const CATALOG_BASE = "/catalog/wikigg";
const SOURCE_NAME = "The Binding of Isaac: Rebirth Wiki (wiki.gg)";
const ATTRIBUTION =
  "Artwork © Nicalis / Edmund McMillen. Source: The Binding of Isaac: Rebirth Wiki (wiki.gg).";
const LICENSE_NOTE =
  "Game artwork is marked IN COPYRIGHT on the source wiki. Verify the file page and fair-use requirements before publishing.";

export function catalogEntryToAsset(entry: CatalogEntry): Asset {
  return {
    id: entry.id,
    name: entry.name,
    category: entry.category,
    imageUrl: entry.imageUrl,
    thumbnailUrl: entry.thumbnailUrl,
    sourceUrl: entry.sourceUrl,
    sourceName: SOURCE_NAME,
    providerId: "wikigg",
    licenseStatus: "copyrighted",
    attribution: ATTRIBUTION,
    licenseNote: LICENSE_NOTE,
    width: entry.width,
    height: entry.height,
    tags: [entry.category, "wiki", "game art", "verified catalog"],
    searchTerms: [entry.name, entry.category, "wiki", "isaac"],
    mime: entry.mime ?? "image/png",
  };
}

let indexPromise: Promise<Asset[]> | null = null;
const categoryPromises = new Map<string, Promise<Asset[]>>();

async function fetchJson(path: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(withBasePath(path), { cache: "force-cache" });
  } catch {
    throw new AssetSourceError(
      "The verified artwork catalog could not be loaded. Check your connection and retry.",
      "catalog_network",
    );
  }
  if (!response.ok) {
    throw new AssetSourceError(
      response.status === 404
        ? "The verified artwork catalog is missing from this build. Run npm run sync:catalog and rebuild."
        : `The verified artwork catalog returned HTTP ${response.status}.`,
      "catalog_http",
      response.status >= 500,
    );
  }
  try {
    return await response.json();
  } catch {
    throw new AssetSourceError(
      "The verified artwork catalog is not valid JSON.",
      "catalog_json",
      false,
    );
  }
}

export function getCatalogAssets(category: CatalogCategory): Promise<Asset[]> {
  const existing = categoryPromises.get(category);
  if (existing) return existing;
  const promise = (async () => {
    const payload = await fetchJson(`${CATALOG_BASE}/${category}.json`);
    const parsed = catalogFileSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AssetSourceError(
        "The verified artwork catalog failed validation. Regenerate it with npm run sync:catalog.",
        "catalog_invalid",
        false,
      );
    }
    if (parsed.data.category !== category) {
      throw new AssetSourceError(
        `Catalog category mismatch: expected ${category}, found ${parsed.data.category}.`,
        "catalog_mismatch",
        false,
      );
    }
    return parsed.data.assets.map(catalogEntryToAsset);
  })().catch((error: unknown) => {
    categoryPromises.delete(category);
    throw error;
  });
  categoryPromises.set(category, promise);
  return promise;
}

export function getCatalogIndex(): Promise<Asset[]> {
  if (indexPromise) return indexPromise;
  indexPromise = (async () => {
    const payload = await fetchJson(`${CATALOG_BASE}/index.json`);
    const parsed = catalogIndexSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AssetSourceError(
        "The verified artwork search index failed validation. Regenerate it with npm run sync:catalog.",
        "catalog_invalid",
        false,
      );
    }
    const unique = new Map<string, Asset>();
    for (const entry of parsed.data.assets) {
      if (!unique.has(entry.id)) unique.set(entry.id, catalogEntryToAsset(entry));
    }
    return [...unique.values()];
  })().catch((error: unknown) => {
    indexPromise = null;
    throw error;
  });
  return indexPromise;
}

export function clearCatalogCache(): void {
  indexPromise = null;
  categoryPromises.clear();
}
