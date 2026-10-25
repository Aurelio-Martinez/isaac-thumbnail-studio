import { useCallback, useEffect, useSyncExternalStore } from "react";
import { resolveAssetSource } from "@/features/assets/resolve";

export type ImageStatus = "idle" | "loading" | "loaded" | "error";

export interface ImageEntry {
  readonly src: string;
  readonly resolvedSrc: string;
  status: ImageStatus;
  image: HTMLImageElement | null;
  error: string | null;
  /** False when the image loaded without CORS and would taint an export canvas. */
  exportSafe: boolean;
  version: number;
  listeners: Set<() => void>;
  promise: Promise<ImageEntry> | null;
  attempt: number;
}

const entries = new Map<string, ImageEntry>();
const MAX_ENTRIES = 220;

function notify(entry: ImageEntry): void {
  entry.version += 1;
  for (const listener of entry.listeners) listener();
}

function getEntry(src: string): ImageEntry {
  const existing = entries.get(src);
  if (existing) return existing;
  const entry: ImageEntry = {
    src,
    resolvedSrc: resolveAssetSource(src),
    status: "idle",
    image: null,
    error: null,
    exportSafe: false,
    version: 0,
    listeners: new Set(),
    promise: null,
    attempt: 0,
  };
  entries.set(src, entry);
  if (entries.size > MAX_ENTRIES) {
    for (const [key, value] of entries) {
      if (entries.size <= MAX_ENTRIES - 20) break;
      if (value.listeners.size === 0 && value.status !== "loading") entries.delete(key);
    }
  }
  return entry;
}

function loadElement(url: string, cors: boolean, signal: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (cors) image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.loading = "eager";
    const cleanup = () => {
      image.onload = null;
      image.onerror = null;
      signal.removeEventListener("abort", onAbort);
    };
    const onAbort = () => {
      cleanup();
      image.src = "";
      reject(new DOMException("Image load aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    image.onload = () => {
      cleanup();
      if (image.naturalWidth === 0 && image.naturalHeight === 0) {
        reject(new Error("Image decoded with zero dimensions"));
        return;
      }
      resolve(image);
    };
    image.onerror = () => {
      cleanup();
      reject(new Error("Image failed to load"));
    };
    image.src = url;
  });
}

async function startLoad(entry: ImageEntry): Promise<ImageEntry> {
  if (entry.status === "loading" && entry.promise) return entry.promise;
  const attempt = entry.attempt + 1;
  entry.attempt = attempt;
  entry.status = "loading";
  entry.error = null;
  notify(entry);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  const candidates: Array<{ url: string; cors: boolean }> = [
    { url: entry.resolvedSrc, cors: true },
  ];
  if (entry.resolvedSrc !== entry.src) {
    // Preview-only fallback. This keeps the editor usable if the proxy is down,
    // but marks the image as unsafe for export so we never emit a tainted PNG.
    candidates.push({ url: entry.src, cors: false });
  }

  const load = (async () => {
    for (const candidate of candidates) {
      try {
        const image = await loadElement(candidate.url, candidate.cors, controller.signal);
        if (entry.attempt !== attempt) return entry;
        entry.image = image;
        entry.status = "loaded";
        entry.exportSafe = candidate.cors;
        entry.error = candidate.cors
          ? null
          : "This image loaded without CORS. Preview works, but PNG export is blocked.";
        notify(entry);
        return entry;
      } catch (error) {
        if ((error as Error).name === "AbortError" && controller.signal.aborted) {
          if (entry.attempt !== attempt) return entry;
          entry.image = null;
          entry.status = "error";
          entry.exportSafe = false;
          entry.error = "Image loading timed out. Check your connection and retry.";
          notify(entry);
          return entry;
        }
      }
    }
    if (entry.attempt !== attempt) return entry;
    entry.image = null;
    entry.status = "error";
    entry.exportSafe = false;
    entry.error =
      "This image could not be loaded. The artwork source may be unavailable or the proxy may be offline.";
    notify(entry);
    return entry;
  })();

  const tracked = load.finally(() => {
    clearTimeout(timeout);
    entry.promise = null;
  });
  entry.promise = tracked;
  return tracked;
}

export function requestImage(src: string): ImageEntry {
  const entry = getEntry(src);
  if (entry.status === "idle" || entry.status === "error") {
    void startLoad(entry);
  }
  return entry;
}

export function ensureImage(src: string): Promise<ImageEntry> {
  if (!src) {
    return Promise.reject(new Error("This layer has no image source."));
  }
  const entry = getEntry(src);
  if (entry.status === "loaded" || entry.status === "error") return Promise.resolve(entry);
  return startLoad(entry);
}

export function retryImage(src: string): Promise<ImageEntry> {
  const entry = getEntry(src);
  entry.status = "idle";
  return startLoad(entry);
}

export function getImageEntry(src: string): ImageEntry | undefined {
  return entries.get(src);
}

export function useAssetImage(src: string | null | undefined): ImageEntry | null {
  const subscribe = useCallback(
    (listener: () => void) => {
      if (!src) return () => {};
      const entry = getEntry(src);
      entry.listeners.add(listener);
      return () => {
        entry.listeners.delete(listener);
      };
    },
    [src],
  );
  const getSnapshot = useCallback(() => (src ? getEntry(src).version : 0), [src]);

  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const entry = src ? getEntry(src) : null;

  useEffect(() => {
    if (!src) return;
    const current = getEntry(src);
    if (current.status === "idle") void startLoad(current);
  }, [src]);

  return entry;
}

export function releaseImage(src: string): void {
  entries.delete(src);
}
