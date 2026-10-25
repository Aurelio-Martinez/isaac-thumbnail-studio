import { APP_CONFIG } from "@/config";
import { isAllowedAssetUrl } from "../../../shared/assetSources";

export function withBasePath(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//")) return path;
  const base = import.meta.env.BASE_URL || "/";
  if (base === "/") return path;
  return `${base.replace(/\/$/, "")}${path}`;
}

export function assetProxyUrl(remoteUrl: string): string {
  const base = APP_CONFIG.assetProxyUrl;
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}url=${encodeURIComponent(remoteUrl)}`;
}

/**
 * Resolves the URL used for canvas rendering.
 * Remote artwork is routed through the same-origin proxy so the export canvas
 * stays untainted. Local files respect Vite's BASE_URL.
 */
export function resolveAssetSource(imageUrl: string | undefined | null): string {
  if (!imageUrl) return "";
  if (imageUrl.startsWith("/")) return withBasePath(imageUrl);
  if (isAllowedAssetUrl(imageUrl)) return assetProxyUrl(imageUrl);
  return imageUrl;
}

export function isRemoteArtwork(imageUrl: string | undefined | null): boolean {
  return Boolean(imageUrl && isAllowedAssetUrl(imageUrl));
}

export function displayThumbnail(imageUrl: string): string {
  return resolveAssetSource(imageUrl);
}
