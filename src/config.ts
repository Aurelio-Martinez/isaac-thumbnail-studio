const readEnv = (value: string | undefined, fallback: string): string => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
};

export const APP_CONFIG = {
  name: readEnv(import.meta.env.VITE_APP_NAME, "Isaac Thumbnail Studio"),
  shortName: readEnv(import.meta.env.VITE_APP_SHORT_NAME, "ITS"),
  tagline: "Compose a thumbnail worth dying for.",
  version: "1.0.0",
  assetProxyUrl: readEnv(import.meta.env.VITE_ASSET_PROXY_URL, "/api/asset-proxy"),
  canvasWidth: 1280,
  canvasHeight: 720,
  minZoom: 0.2,
  maxZoom: 2.5,
  historyLimit: 60,
  maxLayers: 120,
  maxUploadBytes: 8 * 1024 * 1024,
  maxImportBytes: 24 * 1024 * 1024,
  autosaveDelayMs: 900,
} as const;

export const STORAGE_KEYS = {
  projects: "its.projects.v1",
  activeProject: "its.active-project.v1",
  favorites: "its.favorites.v1",
  recent: "its.recent.v1",
  lastSource: "its.asset-source.v1",
  online: "its.online.v1",
} as const;

export const EXPORT_FILENAME_PREFIX = "isaac-thumbnail";
