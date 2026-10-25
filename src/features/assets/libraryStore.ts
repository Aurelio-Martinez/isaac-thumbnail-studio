import { create } from "zustand";
import { STORAGE_KEYS } from "@/config";
import type { AssetRef } from "@/features/assets/types";

interface LibraryState {
  favorites: AssetRef[];
  recent: AssetRef[];
  toggleFavorite: (asset: AssetRef) => void;
  isFavorite: (id: string) => boolean;
  addRecent: (asset: AssetRef) => void;
  clearRecent: () => void;
}

const MAX_RECENT = 16;
const MAX_FAVORITES = 80;

function isAssetRef(value: unknown): value is AssetRef {
  if (!value || typeof value !== "object") return false;
  const ref = value as Partial<AssetRef>;
  return (
    typeof ref.id === "string" &&
    ref.id.length > 0 &&
    ref.id.length <= 200 &&
    typeof ref.name === "string" &&
    ref.name.length > 0 &&
    ref.name.length <= 200 &&
    typeof ref.imageUrl === "string" &&
    typeof ref.thumbnailUrl === "string" &&
    typeof ref.category === "string"
  );
}

function isRemovedBundledRef(ref: AssetRef): boolean {
  return (
    ref.providerId === "bundled" ||
    ref.imageUrl.startsWith("/media/") ||
    ref.thumbnailUrl.startsWith("/media/")
  );
}

function readRefs(key: string): AssetRef[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isAssetRef)
      .filter((ref) => !isRemovedBundledRef(ref))
      .slice(0, MAX_FAVORITES);
  } catch {
    return [];
  }
}

function writeRefs(key: string, refs: AssetRef[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(refs));
  } catch {
    // Favorites are a convenience; quota failures should not break editing.
  }
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  favorites: readRefs(STORAGE_KEYS.favorites),
  recent: readRefs(STORAGE_KEYS.recent),
  toggleFavorite: (asset) => {
    const favorites = get().favorites;
    const exists = favorites.some((entry) => entry.id === asset.id);
    const next = exists
      ? favorites.filter((entry) => entry.id !== asset.id)
      : [asset, ...favorites].slice(0, MAX_FAVORITES);
    writeRefs(STORAGE_KEYS.favorites, next);
    set({ favorites: next });
  },
  isFavorite: (id) => get().favorites.some((asset) => asset.id === id),
  addRecent: (asset) => {
    const next = [asset, ...get().recent.filter((entry) => entry.id !== asset.id)].slice(
      0,
      MAX_RECENT,
    );
    writeRefs(STORAGE_KEYS.recent, next);
    set({ recent: next });
  },
  clearRecent: () => {
    writeRefs(STORAGE_KEYS.recent, []);
    set({ recent: [] });
  },
}));
