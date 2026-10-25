/**
 * Shared, dependency-free allowlist for remote artwork.
 *
 * Copyright note: Binding of Isaac sprites are owned by Nicalis / Edmund McMillen.
 * The studio never bundles or redistributes them. Remote files are streamed through
 * a narrow, allowlisted proxy so they can be composited into an exported PNG; the
 * source page and attribution are always stored with the layer.
 */
export interface AllowedAssetSource {
  host: string;
  pathPrefix: string;
  label: string;
}

export const ALLOWED_ASSET_SOURCES: readonly AllowedAssetSource[] = [
  {
    host: "bindingofisaacrebirth.wiki.gg",
    pathPrefix: "/images/",
    label: "The Binding of Isaac: Rebirth Wiki (wiki.gg)",
  },
  {
    host: "static.wikia.nocookie.net",
    pathPrefix: "/bindingofisaacre_gamepedia/images/",
    label: "The Binding of Isaac: Rebirth Wiki (Fandom)",
  },
];

export const ASSET_PROXY_PATH = "/api/asset-proxy";
export const MAX_ASSET_BYTES = 8 * 1024 * 1024;

export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;

export function isLocalAssetUrl(raw: string): boolean {
  if (raw.startsWith("/") && !raw.startsWith("//")) return true;
  if (raw.startsWith("data:image/")) return true;
  if (raw.startsWith("blob:")) return true;
  return false;
}

/**
 * Returns true only for https URLs on a verified artwork host with the expected
 * image path prefix. Credentials, fragments and non-443 ports are rejected.
 */
export function isAllowedAssetUrl(raw: string): boolean {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 2048) return false;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  if (url.port && url.port !== "443") return false;
  if (url.hash) return false;
  const host = url.hostname.toLowerCase();
  return ALLOWED_ASSET_SOURCES.some(
    (source) => source.host === host && url.pathname.startsWith(source.pathPrefix),
  );
}

export function sourceForUrl(raw: string): AllowedAssetSource | null {
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    return (
      ALLOWED_ASSET_SOURCES.find(
        (source) => source.host === host && url.pathname.startsWith(source.pathPrefix),
      ) ?? null
    );
  } catch {
    return null;
  }
}
