import { beforeEach, describe, expect, it, vi } from "vitest";
import { matchesQuery, AssetSourceError } from "@/features/assets/search";
import { catalogProvider } from "@/features/assets/catalogProvider";
import { clearCatalogCache } from "@/features/assets/catalog";
import {
  clearWikiCache,
  createWikiProvider,
  WIKI_GG,
  getWikiProvider,
} from "@/features/assets/wikiProvider";
import { isAllowedAssetUrl } from "../shared/assetSources";
import { makeAsset, jsonResponse } from "./fixtures";

const character = makeAsset({
  id: "wikigg-file-pip",
  name: "Pip",
  category: "characters",
  tags: ["player", "mascot"],
  searchTerms: ["pip", "blue robe"],
});
const coin = makeAsset({
  id: "wikigg-file-coin",
  name: "Lucky Coin",
  category: "collectibles",
  searchTerms: ["coin", "luck", "gold"],
});
const charm = makeAsset({
  id: "wikigg-file-charm",
  name: "Bone Charm",
  category: "trinkets",
  searchTerms: ["bone", "luck"],
});

const catalogEntry = {
  id: "wikigg-file-100",
  name: "Yum Heart",
  category: "active-items",
  imageUrl: "https://bindingofisaacrebirth.wiki.gg/images/Collectible_Yum_Heart_icon.png",
  thumbnailUrl: "https://bindingofisaacrebirth.wiki.gg/images/Collectible_Yum_Heart_icon.png",
  sourceUrl: "https://bindingofisaacrebirth.wiki.gg/wiki/File:Collectible_Yum_Heart_icon.png",
  width: 32,
  height: 32,
  mime: "image/png",
};
const catalogEntryTwo = {
  id: "wikigg-file-101",
  name: "Yum Heart Rebirth",
  category: "collectibles",
  imageUrl: "https://bindingofisaacrebirth.wiki.gg/images/Collectible_Yum_Heart_Rebirth_icon.png",
  thumbnailUrl:
    "https://bindingofisaacrebirth.wiki.gg/images/Collectible_Yum_Heart_Rebirth_icon.png",
  sourceUrl:
    "https://bindingofisaacrebirth.wiki.gg/wiki/File:Collectible_Yum_Heart_Rebirth_icon.png",
  width: 32,
  height: 32,
  mime: "image/png",
};
const catalogEntryThree = {
  id: "wikigg-file-102",
  name: "Isaac",
  category: "characters",
  imageUrl: "https://bindingofisaacrebirth.wiki.gg/images/Character_Isaac_appearance.png",
  thumbnailUrl: "https://bindingofisaacrebirth.wiki.gg/images/Character_Isaac_appearance.png",
  sourceUrl: "https://bindingofisaacrebirth.wiki.gg/wiki/File:Character_Isaac_appearance.png",
  width: 28,
  height: 33,
  mime: "image/png",
};

function catalogFetch(overrides: Record<string, () => Response> = {}) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    for (const [needle, factory] of Object.entries(overrides)) {
      if (url.includes(needle)) return factory();
    }
    if (url.includes("index.json")) {
      return jsonResponse({
        schemaVersion: 1,
        generatedAt: "2026-10-25T00:00:00.000Z",
        assets: [catalogEntry, catalogEntryTwo, catalogEntryThree],
      });
    }
    if (url.includes("characters.json")) {
      return jsonResponse({
        schemaVersion: 1,
        category: "characters",
        generatedAt: "2026-10-25T00:00:00.000Z",
        assets: [catalogEntryThree, { ...catalogEntryThree, id: "second-character", name: "Cain" }],
      });
    }
    if (url.includes("active-items.json")) {
      return jsonResponse({
        schemaVersion: 1,
        category: "active-items",
        generatedAt: "2026-10-25T00:00:00.000Z",
        assets: [catalogEntry],
      });
    }
    return new Response("not found", { status: 404 });
  });
}

beforeEach(() => {
  clearCatalogCache();
  clearWikiCache();
  vi.unstubAllGlobals();
});

describe("asset matching", () => {
  it("matches case-insensitively", () => {
    expect(matchesQuery(coin, "LUCKY COIN")).toBe(true);
    expect(matchesQuery(character, "PIP")).toBe(true);
  });

  it("matches tags and search terms, and requires all tokens", () => {
    expect(matchesQuery(coin, "gold")).toBe(true);
    expect(matchesQuery(charm, "bone luck")).toBe(true);
    expect(matchesQuery(charm, "bone missing")).toBe(false);
    expect(matchesQuery(character, "coin")).toBe(false);
  });

  it("uses the category name as a search term", () => {
    expect(matchesQuery(charm, "trinket")).toBe(true);
    expect(matchesQuery(character, "character")).toBe(true);
  });
});

describe("verified catalog provider", () => {
  it("browses a category with pagination", async () => {
    const fetchMock = catalogFetch();
    vi.stubGlobal("fetch", fetchMock);
    const first = await catalogProvider.list({
      query: "",
      category: "characters",
      limit: 1,
    });
    expect(first.assets).toHaveLength(1);
    expect(first.assets[0]?.name).toBe("Isaac");
    expect(first.nextCursor).toBe("1");
    expect(first.total).toBe(2);

    const second = await catalogProvider.list({
      query: "",
      category: "characters",
      limit: 1,
      cursor: first.nextCursor,
    });
    expect(second.assets[0]?.name).toBe("Cain");
    expect(second.nextCursor).toBeNull();
  });

  it("searches the compact index and respects the category filter", async () => {
    vi.stubGlobal("fetch", catalogFetch());
    const all = await catalogProvider.search({ query: "yum", category: "all", limit: 10 });
    expect(all.assets.map((asset) => asset.name)).toEqual(["Yum Heart", "Yum Heart Rebirth"]);
    const upper = await catalogProvider.search({ query: "YUM HEART", category: "all", limit: 10 });
    expect(upper.assets.map((asset) => asset.name)).toEqual(["Yum Heart", "Yum Heart Rebirth"]);
    const characters = await catalogProvider.search({
      query: "yum",
      category: "characters",
      limit: 10,
    });
    expect(characters.assets).toHaveLength(0);
  });

  it("returns an empty page for uploads and all-category browsing", async () => {
    vi.stubGlobal("fetch", catalogFetch());
    await expect(
      catalogProvider.list({ query: "", category: "uploads", limit: 10 }),
    ).resolves.toEqual({ assets: [], nextCursor: null, total: 0 });
    await expect(catalogProvider.list({ query: "", category: "all", limit: 10 })).resolves.toEqual({
      assets: [],
      nextCursor: null,
      total: 0,
    });
  });

  it("reports HTTP and validation failures as AssetSourceError", async () => {
    vi.stubGlobal(
      "fetch",
      catalogFetch({ "characters.json": () => new Response("nope", { status: 503 }) }),
    );
    await expect(
      catalogProvider.list({ query: "", category: "characters", limit: 10 }),
    ).rejects.toMatchObject({ name: "AssetSourceError", code: "catalog_http" });
    clearCatalogCache();

    vi.stubGlobal(
      "fetch",
      catalogFetch({
        "characters.json": () =>
          new Response("{broken", { status: 200, headers: { "Content-Type": "application/json" } }),
      }),
    );
    await expect(
      catalogProvider.list({ query: "", category: "characters", limit: 10 }),
    ).rejects.toMatchObject({ name: "AssetSourceError", code: "catalog_json" });
    clearCatalogCache();

    vi.stubGlobal(
      "fetch",
      catalogFetch({
        "characters.json": () =>
          jsonResponse({ schemaVersion: 1, assets: [{ name: "missing fields" }] }),
      }),
    );
    await expect(
      catalogProvider.list({ query: "", category: "characters", limit: 10 }),
    ).rejects.toMatchObject({ name: "AssetSourceError", code: "catalog_invalid" });
  });

  it("exposes the correct provider for each source id", () => {
    expect(getWikiProvider("wikigg-catalog").id).toBe("wikigg-catalog");
    expect(getWikiProvider("wikigg-live").id).toBe("wikigg");
    expect(getWikiProvider("fandom").id).toBe("fandom");
  });
});

describe("live MediaWiki adapter", () => {
  const page = {
    pageid: 42,
    title: "File:Character Isaac appearance.png",
    index: 1,
    imageinfo: [
      {
        url: "https://bindingofisaacrebirth.wiki.gg/images/Character_Isaac_appearance.png",
        thumburl: "https://bindingofisaacrebirth.wiki.gg/images/Character_Isaac_appearance.png",
        width: 28,
        height: 33,
        mime: "image/png",
        descriptionurl:
          "https://bindingofisaacrebirth.wiki.gg/wiki/File:Character_Isaac_appearance.png",
      },
    ],
  };

  it("normalizes category files into assets", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) =>
      jsonResponse({ batchcomplete: true, query: { pages: [page] } }),
    );
    const provider = createWikiProvider(WIKI_GG, fetchMock as typeof fetch);
    const result = await provider.list({ query: "", category: "characters", limit: 10 });
    expect(result.assets).toHaveLength(1);
    expect(result.assets[0]).toMatchObject({
      id: "wikigg-file-42",
      name: "Isaac",
      category: "characters",
      licenseStatus: "copyrighted",
      width: 28,
      height: 33,
    });
    expect(result.assets[0]?.sourceUrl).toContain("File:Character_Isaac_appearance.png");
    const calledWith = String(fetchMock.mock.calls[0]?.[0]);
    expect(calledWith).toContain("generator=categorymembers");
    expect(calledWith).toContain("origin=*");
    expect(calledWith).toContain("prop=imageinfo");
  });

  it("sorts search results by MediaWiki index and infers categories", async () => {
    const pages = [
      { ...page, pageid: 2, index: 2, title: "File:Collectible Yum Heart icon.png" },
      {
        ...page,
        pageid: 1,
        index: 1,
        title: "File:Character Azazel appearance.png",
      },
    ];
    const fetchMock = vi.fn(async () => jsonResponse({ batchcomplete: true, query: { pages } }));
    const provider = createWikiProvider(WIKI_GG, fetchMock as typeof fetch);
    const result = await provider.search({ query: "azazel", category: "all", limit: 10 });
    expect(result.assets.map((asset) => asset.category)).toEqual(["characters", "collectibles"]);
  });

  it("rejects malformed responses and upstream errors", async () => {
    const malformed = vi.fn(
      async () =>
        new Response("{broken", { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    await expect(
      createWikiProvider(WIKI_GG, malformed as typeof fetch).list({
        query: "",
        category: "characters",
        limit: 10,
      }),
    ).rejects.toMatchObject({ code: "wiki_json" });
    clearWikiCache();

    const errorPayload = vi.fn(async () =>
      jsonResponse({ error: { code: "badcontinue", info: "Continue parameter is invalid" } }),
    );
    await expect(
      createWikiProvider(WIKI_GG, errorPayload as typeof fetch).list({
        query: "",
        category: "characters",
        limit: 10,
      }),
    ).rejects.toMatchObject({ code: "badcontinue", retryable: false });
    clearWikiCache();

    const upstream = vi.fn(async () => new Response("oops", { status: 503 }));
    await expect(
      createWikiProvider(WIKI_GG, upstream as typeof fetch).list({
        query: "",
        category: "characters",
        limit: 10,
      }),
    ).rejects.toBeInstanceOf(AssetSourceError);
    clearWikiCache();

    const rateLimited = vi.fn(async () => new Response("slow down", { status: 429 }));
    await expect(
      createWikiProvider(WIKI_GG, rateLimited as typeof fetch).list({
        query: "",
        category: "characters",
        limit: 10,
      }),
    ).rejects.toMatchObject({ code: "rate_limited" });
  });
});

describe("artwork URL allowlist", () => {
  it("accepts the verified wiki image hosts and paths", () => {
    expect(isAllowedAssetUrl("https://bindingofisaacrebirth.wiki.gg/images/Isaac.png")).toBe(true);
    expect(
      isAllowedAssetUrl(
        "https://static.wikia.nocookie.net/bindingofisaacre_gamepedia/images/a/ab/Isaac.png",
      ),
    ).toBe(true);
  });

  it("rejects other hosts, schemes, ports, credentials, and paths", () => {
    expect(isAllowedAssetUrl("http://bindingofisaacrebirth.wiki.gg/images/Isaac.png")).toBe(false);
    expect(isAllowedAssetUrl("https://evil.example/images/Isaac.png")).toBe(false);
    expect(isAllowedAssetUrl("https://bindingofisaacrebirth.wiki.gg/wiki/Isaac")).toBe(false);
    expect(
      isAllowedAssetUrl("https://user:pass@bindingofisaacrebirth.wiki.gg/images/Isaac.png"),
    ).toBe(false);
    expect(isAllowedAssetUrl("https://bindingofisaacrebirth.wiki.gg:8443/images/Isaac.png")).toBe(
      false,
    );
    expect(isAllowedAssetUrl("javascript:alert(1)")).toBe(false);
  });
});
