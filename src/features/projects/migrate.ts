import type { AssetRef } from "@/features/assets/types";
import type { Scene } from "@/features/editor/types";

function isLegacyBundledAsset(asset: AssetRef | null | undefined): boolean {
  if (!asset) return false;
  return (
    asset.providerId === "bundled" ||
    asset.imageUrl.startsWith("/media/") ||
    asset.thumbnailUrl.startsWith("/media/")
  );
}

/**
 * Earlier builds shipped 21 original studio sprites and backdrops. Bundled art
 * has been removed. This migration drops references to those deleted files
 * while preserving text, wiki, and uploaded layers.
 */
export function migrateLegacyBundledAssets(scene: Scene): {
  scene: Scene;
  warnings: string[];
} {
  const clone = structuredClone(scene);
  const removedNames: string[] = [];
  clone.layers = clone.layers.filter((layer) => {
    if (layer.type !== "image") return true;
    if (!isLegacyBundledAsset(layer.asset)) return true;
    removedNames.push(layer.name);
    return false;
  });
  const removedBackground = isLegacyBundledAsset(clone.background.asset);
  if (removedBackground) {
    clone.background.mode = "transparent";
    clone.background.asset = null;
  }
  const warnings: string[] = [];
  if (removedNames.length > 0) {
    warnings.push(
      `${removedNames.length} layer${removedNames.length === 1 ? "" : "s"} using removed bundled artwork ${removedNames.length === 1 ? "was" : "were"} dropped. Add wiki artwork or uploads to replace ${removedNames.length === 1 ? "it" : "them"}.`,
    );
  }
  if (removedBackground) {
    warnings.push(
      "The old bundled background was removed. The canvas is transparent until you choose a wiki backdrop or upload one.",
    );
  }
  return { scene: clone, warnings };
}
