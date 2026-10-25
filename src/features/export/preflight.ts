import type { AssetRef } from "@/features/assets/types";
import type { Scene } from "@/features/editor/types";
import { ensureImage, getImageEntry, type ImageStatus } from "@/features/assets/imageRegistry";

export interface ImageRequirement {
  key: string;
  src: string;
  layerId: string;
  name: string;
  isBackground: boolean;
  asset: AssetRef;
}

export type ImageIssueReason = "missing_upload" | "failed" | "unsafe" | "empty";

export interface ImageIssue {
  key: string;
  name: string;
  reason: ImageIssueReason;
  detail: string;
}

export interface ImageStatusInfo {
  status: ImageStatus;
  exportSafe: boolean;
  error: string | null;
}

export function collectImageRequirements(scene: Scene): ImageRequirement[] {
  const requirements: ImageRequirement[] = [];
  const seen = new Set<string>();
  const background = scene.background;
  if (background.mode === "image" && background.asset) {
    const asset = background.asset;
    const key = `background:${asset.id}`;
    requirements.push({
      key,
      src: asset.imageUrl,
      layerId: "background",
      name: `${asset.name} (background)`,
      isBackground: true,
      asset,
    });
    seen.add(key);
  }
  for (const layer of scene.layers) {
    if (layer.type !== "image" || !layer.visible) continue;
    const asset = layer.asset;
    const key = `${layer.id}:${asset.id}`;
    if (seen.has(key)) continue;
    requirements.push({
      key,
      src: asset.imageUrl,
      layerId: layer.id,
      name: layer.name,
      isBackground: false,
      asset,
    });
    seen.add(key);
  }
  return requirements;
}

export function classifyImageIssues(
  requirements: ImageRequirement[],
  statusFor: (src: string) => ImageStatusInfo | null,
): ImageIssue[] {
  const issues: ImageIssue[] = [];
  for (const requirement of requirements) {
    const asset = requirement.asset;
    if (!requirement.src) {
      issues.push({
        key: requirement.key,
        name: requirement.name,
        reason: asset.uploadId ? "missing_upload" : "empty",
        detail: asset.uploadId
          ? "The uploaded image is not available in this browser. Re-upload it or delete the layer."
          : "This layer has no image source.",
      });
      continue;
    }
    const status = statusFor(requirement.src);
    if (!status) {
      issues.push({
        key: requirement.key,
        name: requirement.name,
        reason: "failed",
        detail: "The image has not been loaded yet.",
      });
      continue;
    }
    if (status.status === "error") {
      issues.push({
        key: requirement.key,
        name: requirement.name,
        reason: "failed",
        detail: status.error ?? "The image failed to load from its source.",
      });
      continue;
    }
    if (status.status !== "loaded") {
      issues.push({
        key: requirement.key,
        name: requirement.name,
        reason: "failed",
        detail: "The image is still loading.",
      });
      continue;
    }
    if (!status.exportSafe) {
      issues.push({
        key: requirement.key,
        name: requirement.name,
        reason: "unsafe",
        detail:
          "This image loaded without CORS, so exporting would produce a tainted canvas. Retry with the artwork proxy online, or replace it with a local upload.",
      });
    }
  }
  return issues;
}

export async function prepareSceneImages(
  scene: Scene,
  onProgress?: (loaded: number, total: number) => void,
): Promise<ImageIssue[]> {
  const requirements = collectImageRequirements(scene);
  const sources = [...new Set(requirements.map((requirement) => requirement.src).filter(Boolean))];
  let loaded = 0;
  onProgress?.(0, sources.length);
  for (const src of sources) {
    await ensureImage(src);
    loaded += 1;
    onProgress?.(loaded, sources.length);
  }
  return classifyImageIssues(requirements, (src) => {
    const entry = getImageEntry(src);
    if (!entry) return null;
    return { status: entry.status, exportSafe: entry.exportSafe, error: entry.error };
  });
}
