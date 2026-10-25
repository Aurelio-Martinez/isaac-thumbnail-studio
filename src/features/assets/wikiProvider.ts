import type {
  Asset,
  AssetCategory,
  AssetPage,
  AssetProvider,
  AssetSearchOptions,
} from "@/features/assets/types";
import { AssetSourceError } from "@/features/assets/search";
import { catalogProvider } from "@/features/assets/catalogProvider";
import { unique } from "@/lib/utils";

export interface WikiSiteConfig {
  id: "wikigg" | "fandom";
  siteName: string;
  apiUrl: string;
  fileBaseUrl: string;
  sourceLabel: string;
}

export const WIKI_GG: WikiSiteConfig = {
  id: "wikigg",
  siteName: "The Binding of Isaac: Rebirth Wiki (wiki.gg)",
  apiUrl: "https://bindingofisaacrebirth.wiki.gg/api.php",
  fileBaseUrl: "https://bindingofisaacrebirth.wiki.gg/wiki/",
  sourceLabel: "Wiki.gg",
};

export const FANDOM_WIKI: WikiSiteConfig = {
  id: "fandom",
  siteName: "The Binding of Isaac: Rebirth Wiki (Fandom)",
  apiUrl: "https://bindingofisaacrebirth.fandom.com/api.php",
  fileBaseUrl: "https://bindingofisaacrebirth.fandom.com/wiki/",
  sourceLabel: "Fandom",
};

export const WIKI_SITES: WikiSiteConfig[] = [WIKI_GG, FANDOM_WIKI];

interface WikiImageInfo {
  url?: string;
  thumburl?: string;
  width?: number;
  height?: number;
  size?: number;
  mime?: string;
  descriptionurl?: string;
  descriptionurlshort?: string;
}

interface WikiPage {
  pageid?: number;
  title?: string;
  index?: number;
  missing?: boolean;
  imageinfo?: WikiImageInfo[];
}

interface WikiResponse {
  batchcomplete?: boolean | string;
  continue?: Record<string, string>;
  error?: { code?: string; info?: string };
  query?: {
    pages?: WikiPage[];
    categorymembers?: Array<{ title?: string; pageid?: number }>;
  };
}

const ALLOWED_MIME = new Set(["image/png", "image/webp", "image/jpeg"]);
const CACHE_TTL_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 15_000;
const cache = new Map<string, { expiresAt: number; value: WikiResponse }>();

export const WIKI_CATEGORY_MAP: Partial<
  Record<AssetCategory, { category: string; titlePattern: RegExp; nameStrip: RegExp }>
> = {
  characters: {
    category: "Character images",
    titlePattern: /^File:Character .+\.(?:png|webp)$/i,
    nameStrip: /^(?:File:|Character )|\.(?:png|webp)$/gi,
  },
  collectibles: {
    category: "Collectible icons",
    titlePattern:
      /^File:Collectible (.+?)(?: (?:Afterbirth|Rebirth|Repentance|Antibirth)\+?)? icon\.(?:png|webp)$/i,
    nameStrip: /^(?:File:|Collectible )| icon\.(?:png|webp)$/gi,
  },
  trinkets: {
    category: "Trinket icons",
    titlePattern: /^File:Trinket (.+?) icon\.(?:png|webp)$/i,
    nameStrip: /^(?:File:|Trinket )| icon\.(?:png|webp)$/gi,
  },
  cards: {
    category: "Card icons",
    titlePattern: /^File:Pickup .+\.(?:png|webp)$/i,
    nameStrip: /^(?:File:|Pickup )|(?: icon)?\.(?:png|webp)$/gi,
  },
  pills: {
    category: "Pill icons",
    titlePattern: /^File:.+\.(?:png|webp)$/i,
    nameStrip: /^(?:File:)|(?: icon)?\.(?:png|webp)$/gi,
  },
  bosses: {
    category: "Boss images",
    titlePattern: /^File:.+\.(?:png|webp)$/i,
    nameStrip: /^(?:File:|Boss )|(?: icon| portrait)?\.(?:png|webp)$/gi,
  },
  backgrounds: {
    category: "Starting room images",
    titlePattern: /^File:.+\.(?:png|webp)$/i,
    nameStrip: /^(?:File:|Stage )|(?: room)?\.(?:png|webp)$/gi,
  },
};

const CATEGORY_BY_PREFIX: Array<{ pattern: RegExp; category: AssetCategory }> = [
  { pattern: /^File:Character /i, category: "characters" },
  { pattern: /^File:Collectible /i, category: "collectibles" },
  { pattern: /^File:Trinket /i, category: "trinkets" },
  { pattern: /^File:Pickup /i, category: "cards" },
  { pattern: /^File:Boss /i, category: "bosses" },
  { pattern: /pill/i, category: "pills" },
  {
    pattern: /(?:Stage|room|Basement|Caves|Depths|Womb|Cathedral|Sheol|Chest|Blue Womb|Mausoleum)/i,
    category: "backgrounds",
  },
];

function withTimeout(signal: AbortSignal | undefined, ms: number) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, ms);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  return {
    signal: controller.signal,
    didTimeOut: () => timedOut,
    cleanup: () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    },
  };
}

async function queryApi(
  config: WikiSiteConfig,
  params: Record<string, string>,
  signal: AbortSignal | undefined,
  fetchImpl: typeof fetch,
): Promise<WikiResponse> {
  const url = new URL(config.apiUrl);
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  url.searchParams.set("origin", "*");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const key = url.toString();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const timeout = withTimeout(signal, REQUEST_TIMEOUT_MS);
  try {
    const response = await fetchImpl(key, {
      signal: timeout.signal,
      headers: { Accept: "application/json" },
      referrerPolicy: "no-referrer",
      credentials: "omit",
      mode: "cors",
    });
    if (!response.ok) {
      if (response.status === 429) {
        throw new AssetSourceError(
          "The wiki is rate-limiting requests. Wait a minute, then retry.",
          "rate_limited",
        );
      }
      throw new AssetSourceError(
        `The wiki responded with HTTP ${response.status}.`,
        "wiki_http",
        response.status >= 500,
      );
    }
    const text = await response.text();
    if (text.length > 3_000_000) {
      throw new AssetSourceError(
        "The wiki response was unexpectedly large.",
        "wiki_oversize",
        false,
      );
    }
    let payload: WikiResponse;
    try {
      payload = JSON.parse(text) as WikiResponse;
    } catch {
      throw new AssetSourceError("The wiki sent malformed JSON.", "wiki_json", true);
    }
    if (payload.error) {
      throw new AssetSourceError(
        `The wiki rejected the request: ${payload.error.info ?? payload.error.code ?? "unknown error"}.`,
        payload.error.code ?? "wiki_error",
        false,
      );
    }
    if (!payload.query) {
      throw new AssetSourceError(
        "The wiki response did not contain query data.",
        "wiki_shape",
        true,
      );
    }
    cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value: payload });
    if (cache.size > 80) {
      const oldest = cache.keys().next().value;
      if (oldest) cache.delete(oldest);
    }
    return payload;
  } catch (error) {
    if (error instanceof AssetSourceError) throw error;
    if ((error as Error).name === "AbortError") {
      if (timeout.didTimeOut()) {
        throw new AssetSourceError("The wiki took too long to respond.", "wiki_timeout", true);
      }
      throw error;
    }
    throw new AssetSourceError(
      "Could not reach the wiki. Check your connection and retry.",
      "wiki_network",
      true,
    );
  } finally {
    timeout.cleanup();
  }
}

function humanizeName(title: string, strip: RegExp): string {
  const base = title.replace(/^File:/i, "").replace(/\.(png|webp|jpe?g)$/i, "");
  const cleaned = base
    .replace(strip, "")
    .replace(/\s+(?:appearance|icon|portrait|room)$/i, "")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > 0 ? cleaned : base;
}

function inferCategory(title: string): AssetCategory {
  for (const entry of CATEGORY_BY_PREFIX) {
    if (entry.pattern.test(title)) return entry.category;
  }
  return "collectibles";
}

function normalizePage(
  config: WikiSiteConfig,
  page: WikiPage,
  category: AssetCategory,
  strip: RegExp,
): Asset | null {
  const info = page.imageinfo?.[0];
  if (!info?.url || !info.width || !info.height) return null;
  const mime = info.mime ?? "image/png";
  if (!ALLOWED_MIME.has(mime)) return null;
  if (info.width < 8 || info.height < 8) return null;
  const title = page.title ?? "";
  const name = humanizeName(title, strip);
  if (!name) return null;
  const pageId = page.pageid ?? Math.abs(hash(title));
  const filePage = info.descriptionurl ?? `${config.fileBaseUrl}${encodeURIComponent(title)}`;
  const thumbnail = info.thumburl && info.thumburl.length > 0 ? info.thumburl : info.url;
  return {
    id: `${config.id}-file-${pageId}`,
    name,
    category,
    imageUrl: info.url,
    thumbnailUrl: thumbnail,
    sourceUrl: filePage,
    sourceName: config.siteName,
    providerId: config.id,
    licenseStatus: "copyrighted",
    attribution: `Artwork © Nicalis / Edmund McMillen. Source: ${config.siteName}.`,
    licenseNote:
      "Game artwork is marked IN COPYRIGHT on the source wiki. Verify the file page and fair-use requirements before publishing.",
    width: info.width,
    height: info.height,
    tags: unique([category, "wiki", "game art"]),
    searchTerms: unique([name, title.replace(/^File:/, ""), category, config.sourceLabel]),
    mime,
  };
}

function hash(value: string): number {
  let result = 0;
  for (let i = 0; i < value.length; i += 1) {
    result = (result * 31 + value.charCodeAt(i)) | 0;
  }
  return result;
}

function encodeCursor(continuation: Record<string, string> | undefined): string | null {
  if (!continuation) return null;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(continuation)) params.set(key, value);
  return params.toString();
}

function cursorParams(cursor: string | null | undefined): Record<string, string> {
  if (!cursor) return {};
  const result: Record<string, string> = {};
  new URLSearchParams(cursor).forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

function isAbortError(error: unknown): boolean {
  return (error as Error)?.name === "AbortError";
}

export function createWikiProvider(
  config: WikiSiteConfig,
  fetchImpl: typeof fetch = fetch,
): AssetProvider {
  const activeItemsCache = new Map<string, Asset[]>();

  async function listCategory(
    options: AssetSearchOptions,
    category: AssetCategory,
  ): Promise<AssetPage> {
    if (category === "active-items") {
      const assets = await loadActiveItems(options.signal);
      return paginateAssets(assets, options);
    }
    const categoryConfig = WIKI_CATEGORY_MAP[category];
    if (!categoryConfig) return { assets: [], nextCursor: null, total: 0 };
    const params: Record<string, string> = {
      generator: "categorymembers",
      gcmtitle: `Category:${categoryConfig.category}`,
      gcmtype: "file",
      gcmlimit: "50",
      prop: "imageinfo",
      iiprop: "url|size|mime",
      iiurlwidth: "256",
      ...cursorParams(options.cursor),
    };
    const data = await queryApi(config, params, options.signal, fetchImpl);
    const assets = (data.query?.pages ?? [])
      .filter((page) => categoryConfig.titlePattern.test(page.title ?? ""))
      .map((page) => normalizePage(config, page, category, categoryConfig.nameStrip))
      .filter((asset): asset is Asset => asset !== null);
    return {
      assets,
      nextCursor: encodeCursor(data.continue),
      total: undefined,
    };
  }

  async function search(options: AssetSearchOptions): Promise<AssetPage> {
    const query = options.query.trim();
    if (!query) return { assets: [], nextCursor: null, total: 0 };
    const params: Record<string, string> = {
      generator: "search",
      gsrsearch: query,
      gsrnamespace: "6",
      gsrlimit: String(Math.min(50, Math.max(1, options.limit))),
      prop: "imageinfo",
      iiprop: "url|size|mime",
      iiurlwidth: "256",
      ...cursorParams(options.cursor),
    };
    const data = await queryApi(config, params, options.signal, fetchImpl);
    const pages = [...(data.query?.pages ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    const assets = pages
      .map((page) => {
        const category = inferCategory(page.title ?? "");
        const strip = WIKI_CATEGORY_MAP[category]?.nameStrip ?? /^(?:File:)|\.(?:png|webp)$/gi;
        return normalizePage(config, page, category, strip);
      })
      .filter((asset): asset is Asset => asset !== null);
    return {
      assets,
      nextCursor: encodeCursor(data.continue),
      total: undefined,
    };
  }

  async function loadActiveItems(signal: AbortSignal | undefined): Promise<Asset[]> {
    const cached = activeItemsCache.get(config.id);
    if (cached) return cached;
    const pageTitles: string[] = [];
    let cursor: Record<string, string> | undefined;
    for (let page = 0; page < 4; page += 1) {
      const data = await queryApi(
        config,
        {
          list: "categorymembers",
          cmtitle: "Category:Activated collectibles",
          cmtype: "page",
          cmlimit: "500",
          ...cursor,
        },
        signal,
        fetchImpl,
      );
      for (const member of data.query?.categorymembers ?? []) {
        if (member.title) pageTitles.push(member.title);
      }
      cursor = data.continue;
      if (!cursor) break;
    }
    if (pageTitles.length === 0) {
      activeItemsCache.set(config.id, []);
      return [];
    }
    const assets: Asset[] = [];
    for (let i = 0; i < pageTitles.length; i += 40) {
      const chunk = pageTitles.slice(i, i + 40);
      const data = await queryApi(
        config,
        {
          titles: chunk.map((name) => `File:Collectible ${name} icon.png`).join("|"),
          prop: "imageinfo",
          iiprop: "url|size|mime",
          iiurlwidth: "256",
        },
        signal,
        fetchImpl,
      );
      for (const page of data.query?.pages ?? []) {
        if (page.missing) continue;
        const asset = normalizePage(
          config,
          page,
          "active-items",
          /^(?:File:|Collectible )| icon\.(?:png|webp)$/gi,
        );
        if (asset) assets.push(asset);
      }
    }
    const sorted = assets.sort((a, b) => a.name.localeCompare(b.name));
    activeItemsCache.set(config.id, sorted);
    return sorted;
  }

  return {
    id: config.id,
    name: config.siteName,
    shortName: config.sourceLabel,
    kind: "remote",
    attribution: `Artwork served live from ${config.siteName}. Game art © Nicalis / Edmund McMillen, marked IN COPYRIGHT on the wiki.`,
    async list(options) {
      if (options.category === "all" || options.category === "uploads") {
        return { assets: [], nextCursor: null, total: 0 };
      }
      return listCategory(options, options.category);
    },
    search,
  };
}

function paginateAssets(assets: Asset[], options: AssetSearchOptions): AssetPage {
  const offset = Number(options.cursor ?? "0");
  const start = Number.isFinite(offset) && offset > 0 ? offset : 0;
  const limit = Math.min(100, Math.max(1, options.limit));
  const slice = assets.slice(start, start + limit);
  const next = start + slice.length < assets.length ? String(start + slice.length) : null;
  return { assets: slice, nextCursor: next, total: assets.length };
}

export const wikiGgProvider = createWikiProvider(WIKI_GG);
export const fandomProvider = createWikiProvider(FANDOM_WIKI);

export type RemoteSourceId = "wikigg-catalog" | "wikigg-live" | "fandom";

export const REMOTE_SOURCES: Array<{
  id: RemoteSourceId;
  label: string;
  shortLabel: string;
  hint: string;
}> = [
  {
    id: "wikigg-catalog",
    label: "Wiki.gg catalog (recommended)",
    shortLabel: "Wiki.gg catalog",
    hint: "1,613 verified files. Instant search; images stream through the proxy.",
  },
  {
    id: "wikigg-live",
    label: "Wiki.gg live API",
    shortLabel: "Wiki.gg live",
    hint: "Queries the MediaWiki API directly. Needs browser access to wiki.gg.",
  },
  {
    id: "fandom",
    label: "Fandom API (images may fail)",
    shortLabel: "Fandom",
    hint: "Metadata works, but Fandom's image host often blocks hotlinking.",
  },
];

export function getWikiProvider(id: RemoteSourceId): AssetProvider {
  if (id === "fandom") return fandomProvider;
  if (id === "wikigg-live") return wikiGgProvider;
  return catalogProvider;
}

export function clearWikiCache(): void {
  cache.clear();
}

export { isAbortError };
