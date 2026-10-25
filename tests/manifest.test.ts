import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { catalogEntrySchema } from "@/features/assets/catalog";
import { isAllowedAssetUrl } from "../shared/assetSources";

function readJson<T>(relative: string): T {
  return JSON.parse(readFileSync(path.join(process.cwd(), relative), "utf8")) as T;
}

const catalogManifest = readJson<{
  total: number;
  categories: Record<string, number>;
  generatedAt: string;
}>("public/catalog/wikigg/manifest.json");
const catalogIndex = readJson<{ assets: unknown[] }>("public/catalog/wikigg/index.json");

describe("verified wiki.gg metadata catalog", () => {
  it("has consistent counts and unique index ids", () => {
    expect(catalogManifest.total).toBeGreaterThan(1000);
    expect(catalogIndex.assets).toHaveLength(catalogManifest.total);
    const ids = new Set<string>();
    let parsed = 0;
    for (const entry of catalogIndex.assets) {
      const result = catalogEntrySchema.safeParse(entry);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(isAllowedAssetUrl(result.data.imageUrl)).toBe(true);
        expect(isAllowedAssetUrl(result.data.thumbnailUrl)).toBe(true);
        expect(ids.has(result.data.id)).toBe(false);
        ids.add(result.data.id);
        parsed += 1;
      }
    }
    expect(parsed).toBe(catalogManifest.total);
  });

  it("keeps category files aligned with the manifest", () => {
    for (const [category, count] of Object.entries(catalogManifest.categories)) {
      const file = readJson<{ category: string; assets: unknown[] }>(
        `public/catalog/wikigg/${category}.json`,
      );
      expect(file.category).toBe(category);
      expect(file.assets).toHaveLength(count);
      for (const entry of file.assets) {
        expect(catalogEntrySchema.safeParse(entry).success).toBe(true);
      }
    }
  });

  it("provides a background catalog for the background selector", () => {
    const backgrounds = readJson<{ assets: Array<{ category: string; sourceUrl: string }> }>(
      "public/catalog/wikigg/backgrounds.json",
    );
    expect(backgrounds.assets.length).toBeGreaterThan(0);
    expect(backgrounds.assets.every((asset) => asset.category === "backgrounds")).toBe(true);
    expect(backgrounds.assets.every((asset) => asset.sourceUrl.startsWith("https://"))).toBe(true);
  });

  it("does not bundle any artwork files alongside the metadata", () => {
    expect(existsSync(path.join(process.cwd(), "public/media"))).toBe(false);
    const folder = path.join(process.cwd(), "public/catalog/wikigg");
    const names = readdirSync(folder);
    expect(names.filter((name) => /\.(png|jpe?g|webp|gif|svg)$/i.test(name))).toEqual([]);
  });
});
