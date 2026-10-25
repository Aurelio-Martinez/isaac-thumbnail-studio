import { ALLOWED_IMAGE_TYPES, isAllowedAssetUrl, MAX_ASSET_BYTES } from "./assetSources";

export interface ProxySuccess {
  ok: true;
  status: number;
  body: Uint8Array;
  contentType: string;
  cache: "HIT" | "MISS";
}

export interface ProxyFailure {
  ok: false;
  status: number;
  error: string;
  message: string;
}

export type ProxyResult = ProxySuccess | ProxyFailure;

interface CacheEntry {
  body: Uint8Array;
  contentType: string;
  storedAt: number;
}

const CACHE_TTL_MS = 15 * 60 * 1000;
const CACHE_MAX_ENTRIES = 40;
const CACHE_MAX_BYTES = 24 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 2;

const cache = new Map<string, CacheEntry>();
let cacheBytes = 0;

function cacheGet(key: string): CacheEntry | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.storedAt > CACHE_TTL_MS) {
    cache.delete(key);
    cacheBytes -= entry.body.byteLength;
    return undefined;
  }
  return entry;
}

function cacheSet(key: string, entry: CacheEntry): void {
  const existing = cache.get(key);
  if (existing) cacheBytes -= existing.body.byteLength;
  cache.set(key, entry);
  cacheBytes += entry.body.byteLength;
  while (cache.size > CACHE_MAX_ENTRIES || cacheBytes > CACHE_MAX_BYTES) {
    const oldest = cache.keys().next().value;
    if (!oldest) break;
    const removed = cache.get(oldest);
    cache.delete(oldest);
    if (removed) cacheBytes -= removed.body.byteLength;
  }
}

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

/** Best-effort per-instance rate limit. Serverless instances restart, so this is a speed bump. */
export function allowRequest(ip: string, limit = 180, windowMs = 60_000): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(ip, { count: 1, resetAt: now + windowMs });
    if (rateBuckets.size > 2_000) {
      for (const [key, value] of rateBuckets) {
        if (value.resetAt <= now) rateBuckets.delete(key);
      }
    }
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

function failure(status: number, error: string, message: string): ProxyFailure {
  return { ok: false, status, error, message };
}

async function readLimited(response: Response): Promise<Uint8Array> {
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (declared > MAX_ASSET_BYTES) {
    throw Object.assign(new Error("Asset exceeds the 8 MB limit"), { code: "too_large" });
  }
  if (!response.body) {
    const buffer = new Uint8Array(await response.arrayBuffer());
    if (buffer.byteLength > MAX_ASSET_BYTES) {
      throw Object.assign(new Error("Asset exceeds the 8 MB limit"), { code: "too_large" });
    }
    return buffer;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > MAX_ASSET_BYTES) {
      await reader.cancel();
      throw Object.assign(new Error("Asset exceeds the 8 MB limit"), { code: "too_large" });
    }
    chunks.push(value);
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

async function fetchFollowingSafeRedirects(target: string, signal: AbortSignal): Promise<Response> {
  let current = target;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const response = await fetch(current, {
      redirect: "manual",
      signal,
      headers: {
        Accept: "image/png,image/webp,image/jpeg,image/gif;q=0.8",
        "User-Agent":
          "IsaacThumbnailStudio/1.0 (+https://github.com/; thumbnail compositor; contact via repository)",
      },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return response;
      const next = new URL(location, current).toString();
      if (!isAllowedAssetUrl(next)) {
        return new Response("Redirect target is not an allowed artwork source", { status: 502 });
      }
      current = next;
      continue;
    }
    return response;
  }
  return new Response("Too many redirects", { status: 508 });
}

export async function fetchAsset(rawUrl: string, requestIp = "unknown"): Promise<ProxyResult> {
  if (!isAllowedAssetUrl(rawUrl)) {
    return failure(
      400,
      "invalid_url",
      "Only artwork URLs from the configured Isaac wiki hosts are allowed.",
    );
  }

  // Cached artwork never counts against the upstream request budget.
  const cached = cacheGet(rawUrl);
  if (cached) {
    return {
      ok: true,
      status: 200,
      body: cached.body,
      contentType: cached.contentType,
      cache: "HIT",
    };
  }

  if (!allowRequest(requestIp)) {
    return failure(429, "rate_limited", "Too many image requests. Wait a moment and retry.");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetchFollowingSafeRedirects(rawUrl, controller.signal);
    if (!response.ok) {
      return failure(
        response.status === 404 ? 404 : 502,
        "upstream_error",
        `Artwork source responded with HTTP ${response.status}.`,
      );
    }
    const contentType = (response.headers.get("content-type") ?? "")
      .split(";")[0]!
      .trim()
      .toLowerCase();
    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(contentType)) {
      return failure(415, "unsupported_type", "The upstream file is not a supported raster image.");
    }
    let body: Uint8Array;
    try {
      body = await readLimited(response);
    } catch (error) {
      if ((error as { code?: string }).code === "too_large") {
        return failure(413, "too_large", "Artwork exceeds the 8 MB proxy limit.");
      }
      throw error;
    }
    if (body.byteLength === 0) {
      return failure(502, "empty_asset", "The artwork source returned an empty file.");
    }
    cacheSet(rawUrl, { body, contentType, storedAt: Date.now() });
    return { ok: true, status: 200, body, contentType, cache: "MISS" };
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      return failure(504, "timeout", "The artwork source took too long to respond.");
    }
    return failure(502, "network_error", "Could not reach the artwork source.");
  } finally {
    clearTimeout(timer);
  }
}

const PROXY_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cross-Origin-Resource-Policy": "cross-origin",
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
};

export async function handleProxyRequest(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: PROXY_HEADERS });
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return Response.json(
      { error: "method_not_allowed", message: "Use GET." },
      { status: 405, headers: { ...PROXY_HEADERS, Allow: "GET, HEAD, OPTIONS" } },
    );
  }
  const url = new URL(request.url);
  const target = url.searchParams.get("url") ?? "";
  const ip =
    request.headers.get("x-nf-client-connection-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  const result = await fetchAsset(target, ip);
  if (!result.ok) {
    return Response.json(
      { error: result.error, message: result.message },
      {
        status: result.status,
        headers: { ...PROXY_HEADERS, "Cache-Control": "no-store" },
      },
    );
  }
  return new Response(request.method === "HEAD" ? null : (result.body as unknown as BodyInit), {
    status: 200,
    headers: {
      ...PROXY_HEADERS,
      "Content-Type": result.contentType,
      "Content-Length": String(result.body.byteLength),
      "X-Artwork-Cache": result.cache,
    },
  });
}

interface NodeRequestLike {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
}

interface NodeResponseLike {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: Uint8Array | string): void;
  headersSent: boolean;
}

/** Connect middleware used by the Vite dev/preview server so local dev matches Netlify. */
export async function assetProxyMiddleware(
  request: NodeRequestLike,
  response: NodeResponseLike,
): Promise<void> {
  const method = request.method ?? "GET";
  for (const [name, value] of Object.entries(PROXY_HEADERS)) {
    response.setHeader(name, value);
  }
  if (method === "OPTIONS") {
    response.statusCode = 204;
    response.end();
    return;
  }
  if (method !== "GET" && method !== "HEAD") {
    response.statusCode = 405;
    response.setHeader("Content-Type", "application/json");
    response.setHeader("Allow", "GET, HEAD, OPTIONS");
    response.end(JSON.stringify({ error: "method_not_allowed", message: "Use GET." }));
    return;
  }
  const parsed = new URL(request.url ?? "/", "http://localhost");
  const target = parsed.searchParams.get("url") ?? "";
  const headerIp = request.headers["x-forwarded-for"];
  const ip = Array.isArray(headerIp) ? headerIp[0] : (headerIp ?? "local");
  const result = await fetchAsset(target, ip ?? "local");
  response.setHeader("Content-Type", "application/json");
  if (!result.ok) {
    response.statusCode = result.status;
    response.setHeader("Cache-Control", "no-store");
    response.end(JSON.stringify({ error: result.error, message: result.message }));
    return;
  }
  response.setHeader("Content-Type", result.contentType);
  response.setHeader("Content-Length", String(result.body.byteLength));
  response.statusCode = 200;
  response.end(method === "HEAD" ? undefined : result.body);
}
