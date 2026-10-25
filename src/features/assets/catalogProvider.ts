import type { AssetPage, AssetProvider, AssetSearchOptions } from "@/features/assets/types";
import { getCatalogAssets, getCatalogIndex, type CatalogCategory } from "@/features/assets/catalog";
import { matchesQuery } from "@/features/assets/search";
import { ASSET_CATEGORIES } from "@/features/assets/types";

const SUPPORTED = new Set<string>(ASSET_CATEGORIES.filter((category) => category !== "uploads"));

function paginateAssets(
  assets: Awaited<ReturnType<typeof getCatalogIndex>>,
  options: AssetSearchOptions,
): AssetPage {
  const offset = Number(options.cursor ?? "0");
  const start = Number.isFinite(offset) && offset > 0 ? offset : 0;
  const limit = Math.min(100, Math.max(1, options.limit));
  const slice = assets.slice(start, start + limit);
  return {
    assets: slice,
    nextCursor: start + slice.length < assets.length ? String(start + slice.length) : null,
    total: assets.length,
  };
}

export const catalogProvider: AssetProvider = {
  id: "wikigg-catalog",
  name: "Wiki.gg verified catalog",
  shortName: "Wiki.gg catalog",
  kind: "remote",
  attribution:
    "Metadata synchronized from The Binding of Isaac: Rebirth Wiki (wiki.gg). Artwork © Nicalis / Edmund McMillen, marked IN COPYRIGHT. Images stream live through the artwork proxy.",
  async list(options: AssetSearchOptions): Promise<AssetPage> {
    if (options.category === "all" || !SUPPORTED.has(options.category)) {
      return { assets: [], nextCursor: null, total: 0 };
    }
    const assets = await getCatalogAssets(options.category as CatalogCategory);
    return paginateAssets(assets, options);
  },
  async search(options: AssetSearchOptions): Promise<AssetPage> {
    const query = options.query.trim();
    if (!query) return { assets: [], nextCursor: null, total: 0 };
    const all = await getCatalogIndex();
    const normalized = query.toLowerCase();
    const filtered = all
      .filter((asset) => options.category === "all" || asset.category === options.category)
      .filter((asset) => matchesQuery(asset, query))
      .sort((a, b) => {
        const nameA = a.name.toLowerCase();
        const nameB = b.name.toLowerCase();
        const score = (name: string) =>
          name === normalized
            ? 0
            : name.startsWith(normalized)
              ? 1
              : name.includes(normalized)
                ? 2
                : 3;
        return score(nameA) - score(nameB) || a.name.localeCompare(b.name);
      });
    return paginateAssets(filtered, options);
  },
};
