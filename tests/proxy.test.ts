import { afterEach, describe, expect, it, vi } from "vitest";
import { allowRequest, fetchAsset, handleProxyRequest } from "../shared/assetProxy";

const allowed = "https://bindingofisaacrebirth.wiki.gg/images/Test_Asset.png";
let counter = 0;
const nextIp = () => `test-ip-${Date.now()}-${counter++}`;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("asset proxy security", () => {
  it("rejects non-allowlisted URLs without making a request", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const result = await fetchAsset("https://evil.example/image.png", nextIp());
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();

    const http = await fetchAsset(
      "http://bindingofisaacrebirth.wiki.gg/images/Test_Asset.png",
      nextIp(),
    );
    expect(http.ok).toBe(false);
    expect(http.status).toBe(400);
  });

  it("rate-limits requests per caller", () => {
    const ip = nextIp();
    expect(allowRequest(ip, 2, 60_000)).toBe(true);
    expect(allowRequest(ip, 2, 60_000)).toBe(true);
    expect(allowRequest(ip, 2, 60_000)).toBe(false);
  });

  it("maps upstream failures to safe errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("missing", { status: 404 })),
    );
    const notFound = await fetchAsset(`${allowed}?missing`, nextIp());
    expect(notFound).toMatchObject({ ok: false, status: 404, error: "upstream_error" });

    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("not an image", {
            status: 200,
            headers: { "Content-Type": "text/html" },
          }),
      ),
    );
    const unsupported = await fetchAsset(`${allowed}?html`, nextIp());
    expect(unsupported).toMatchObject({ ok: false, status: 415, error: "unsupported_type" });
  });

  it("streams an allowed image and reports its content type", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(new Uint8Array([137, 80, 78, 71]), {
            status: 200,
            headers: { "Content-Type": "image/png" },
          }),
      ),
    );
    const result = await fetchAsset(`${allowed}?ok`, nextIp());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.contentType).toBe("image/png");
      expect(result.body.byteLength).toBe(4);
      expect(result.cache).toBe("MISS");
    }
  });

  it("rejects unsupported methods and handles CORS preflight", async () => {
    const post = await handleProxyRequest(
      new Request("https://studio.example/api/asset-proxy", { method: "POST" }),
    );
    expect(post.status).toBe(405);
    expect(post.headers.get("Access-Control-Allow-Origin")).toBe("*");

    const options = await handleProxyRequest(
      new Request("https://studio.example/api/asset-proxy", { method: "OPTIONS" }),
    );
    expect(options.status).toBe(204);
    expect(options.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("returns 400 through the HTTP handler for a bad target", async () => {
    const response = await handleProxyRequest(
      new Request(
        `https://studio.example/api/asset-proxy?url=${encodeURIComponent("https://evil.example/a.png")}`,
      ),
    );
    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toBe("invalid_url");
  });
});
