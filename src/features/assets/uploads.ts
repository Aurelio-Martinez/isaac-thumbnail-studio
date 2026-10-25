import { createStore, del, get, keys, set } from "idb-keyval";
import { APP_CONFIG } from "@/config";
import type { Asset, AssetRef } from "@/features/assets/types";
import { makeId, type Scene } from "@/features/editor/types";
import { blobToDataUrl, dataUrlToBlob } from "@/lib/utils";

const store = createStore("isaac-thumbnail-studio", "uploads");
const memoryFallback = new Map<string, UploadRecord>();
const objectUrls = new Map<string, string>();

export interface UploadRecord {
  id: string;
  name: string;
  mime: string;
  width: number;
  height: number;
  createdAt: string;
  blob: Blob;
}

const ALLOWED_UPLOAD_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

export function isSupportedUpload(file: File | Blob): boolean {
  return ALLOWED_UPLOAD_TYPES.has(file.type);
}

async function readDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob);
      const dimensions = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return dimensions;
    } catch {
      // Fall through to the <img> decoder.
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("This image could not be decoded."));
      element.src = url;
    });
    return { width: image.naturalWidth, height: image.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function readRecord(uploadId: string): Promise<UploadRecord | null> {
  const fallback = memoryFallback.get(uploadId);
  if (fallback) return fallback;
  try {
    const record = await get<UploadRecord>(uploadId, store);
    return record ?? null;
  } catch {
    return null;
  }
}

export function uploadObjectUrl(record: UploadRecord): string {
  const existing = objectUrls.get(record.id);
  if (existing) return existing;
  const url = URL.createObjectURL(record.blob);
  objectUrls.set(record.id, url);
  return url;
}

function recordToAsset(record: UploadRecord): Asset {
  const url = uploadObjectUrl(record);
  return {
    id: `upload-${record.id}`,
    name: record.name,
    category: "uploads",
    imageUrl: url,
    thumbnailUrl: url,
    sourceUrl: "",
    sourceName: "Your upload",
    providerId: "uploads",
    licenseStatus: "unknown",
    attribution: "Uploaded by you. You are responsible for the rights to this image.",
    licenseNote: "Stored only in this browser's IndexedDB until you export a portable project.",
    width: record.width,
    height: record.height,
    tags: ["upload", "custom"],
    searchTerms: [record.name, "upload", "custom"],
    uploadId: record.id,
    mime: record.mime,
  };
}

export async function saveUpload(file: File): Promise<Asset> {
  if (!isSupportedUpload(file)) {
    throw new Error("Use a PNG, JPEG, WebP, GIF, or SVG image.");
  }
  if (file.size > APP_CONFIG.maxUploadBytes) {
    throw new Error(
      `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The upload limit is 8 MB.`,
    );
  }
  const dimensions = await readDimensions(file);
  if (dimensions.width < 2 || dimensions.height < 2) {
    throw new Error("That image is too small to use.");
  }
  const record: UploadRecord = {
    id: makeId("up").replace("up-", ""),
    name: file.name.replace(/\.[^.]+$/, "").slice(0, 100) || "Upload",
    mime: file.type,
    width: dimensions.width,
    height: dimensions.height,
    createdAt: new Date().toISOString(),
    blob: file,
  };
  memoryFallback.set(record.id, record);
  try {
    await set(record.id, record, store);
  } catch {
    // IndexedDB can be unavailable in private mode. Keep the in-memory copy.
  }
  return recordToAsset(record);
}

export async function importUpload(
  uploadId: string,
  blob: Blob,
  meta: { name: string; width: number; height: number; mime?: string },
): Promise<Asset> {
  const record: UploadRecord = {
    id: uploadId,
    name: meta.name.slice(0, 100) || "Recovered upload",
    mime: meta.mime ?? blob.type ?? "image/png",
    width: Math.max(1, Math.round(meta.width)),
    height: Math.max(1, Math.round(meta.height)),
    createdAt: new Date().toISOString(),
    blob,
  };
  const previous = objectUrls.get(uploadId);
  if (previous) {
    URL.revokeObjectURL(previous);
    objectUrls.delete(uploadId);
  }
  memoryFallback.set(uploadId, record);
  try {
    await set(uploadId, record, store);
  } catch {
    // Keep memory copy.
  }
  return recordToAsset(record);
}

export async function listUploads(): Promise<Asset[]> {
  const records = new Map<string, UploadRecord>(memoryFallback);
  try {
    const storedKeys = await keys(store);
    for (const key of storedKeys) {
      if (typeof key !== "string") continue;
      const record = await get<UploadRecord>(key, store);
      if (record) records.set(key, record);
    }
  } catch {
    // Memory fallback only.
  }
  return [...records.values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(recordToAsset);
}

export async function getUploadAsset(uploadId: string): Promise<Asset | null> {
  const record = await readRecord(uploadId);
  return record ? recordToAsset(record) : null;
}

export async function deleteUpload(uploadId: string): Promise<void> {
  memoryFallback.delete(uploadId);
  const url = objectUrls.get(uploadId);
  if (url) {
    URL.revokeObjectURL(url);
    objectUrls.delete(uploadId);
  }
  try {
    await del(uploadId, store);
  } catch {
    // Nothing else to clean up.
  }
}

export function releaseAllUploadUrls(): void {
  for (const url of objectUrls.values()) URL.revokeObjectURL(url);
  objectUrls.clear();
}

export async function hydrateSceneUploads(
  scene: Scene,
): Promise<{ scene: Scene; missing: Array<{ layerId: string; name: string }> }> {
  const clone = structuredClone(scene);
  const missing: Array<{ layerId: string; name: string }> = [];
  const cache = new Map<string, string | null>();

  const resolveUpload = async (uploadId: string): Promise<string | null> => {
    if (cache.has(uploadId)) return cache.get(uploadId) ?? null;
    const asset = await getUploadAsset(uploadId);
    const url = asset?.imageUrl ?? null;
    cache.set(uploadId, url);
    return url;
  };

  const hydrateAsset = async (
    asset: AssetRef | null,
    layerId = "background",
    name = "Background",
  ): Promise<AssetRef | null> => {
    if (!asset) return null;
    if (!asset.uploadId) {
      if (!asset.imageUrl) {
        missing.push({ layerId, name: asset.name || name });
      }
      return asset;
    }
    const url = await resolveUpload(asset.uploadId);
    if (!url) {
      missing.push({ layerId, name: asset.name || name });
      return { ...asset, imageUrl: "", thumbnailUrl: "" };
    }
    return { ...asset, imageUrl: url, thumbnailUrl: url };
  };

  clone.background.asset = await hydrateAsset(clone.background.asset);
  for (const layer of clone.layers) {
    if (layer.type !== "image") continue;
    const hydrated = await hydrateAsset(layer.asset, layer.id, layer.name);
    if (hydrated) layer.asset = hydrated;
  }
  return { scene: clone, missing };
}

export async function embedUploads(scene: Scene): Promise<{
  embedded: Record<string, string>;
  missing: string[];
}> {
  const ids = new Set<string>();
  if (scene.background.asset?.uploadId) ids.add(scene.background.asset.uploadId);
  for (const layer of scene.layers) {
    if (layer.type === "image" && layer.asset.uploadId) ids.add(layer.asset.uploadId);
  }
  if (ids.size > 30) {
    throw new Error("Portable exports support at most 30 uploaded images.");
  }
  const embedded: Record<string, string> = {};
  const missing: string[] = [];
  let totalCharacters = 0;
  for (const uploadId of ids) {
    const record = await readRecord(uploadId);
    if (!record) {
      missing.push(uploadId);
      continue;
    }
    const dataUrl = await blobToDataUrl(record.blob);
    totalCharacters += dataUrl.length;
    if (totalCharacters > 20_000_000) {
      throw new Error(
        "Portable JSON is limited to 20 MB of embedded uploads. Remove some uploaded images or keep the project in this browser.",
      );
    }
    embedded[uploadId] = dataUrl;
  }
  return { embedded, missing };
}

export async function restoreEmbeddedAssets(
  embedded: Record<string, string>,
  refs: AssetRef[],
): Promise<{ restored: number; missing: string[] }> {
  let restored = 0;
  const missing: string[] = [];
  for (const [uploadId, dataUrl] of Object.entries(embedded)) {
    try {
      const blob = dataUrlToBlob(dataUrl);
      const ref = refs.find((asset) => asset.uploadId === uploadId);
      await importUpload(uploadId, blob, {
        name: ref?.name ?? "Recovered upload",
        width: ref?.width ?? 512,
        height: ref?.height ?? 512,
        mime: blob.type,
      });
      restored += 1;
    } catch {
      missing.push(uploadId);
    }
  }
  return { restored, missing };
}

export function stripUploadUrls(scene: Scene): Scene {
  const clone = structuredClone(scene);
  const strip = (asset: AssetRef | null): AssetRef | null => {
    if (!asset?.uploadId) return asset;
    return { ...asset, imageUrl: "", thumbnailUrl: "" };
  };
  clone.background.asset = strip(clone.background.asset);
  for (const layer of clone.layers) {
    if (layer.type === "image") layer.asset = strip(layer.asset) ?? layer.asset;
  }
  return clone;
}
