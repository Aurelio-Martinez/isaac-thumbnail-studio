import { defaultLayerHeight, type Scene } from "@/features/editor/types";

export const OUTLINE_MAX_RATIO = 0.06;
export const MIN_OUTLINE_WIDTH = 1;

/**
 * Outline width is chosen at the layer's current size. The chosen width is the
 * maximum: below that anchor it scales down proportionally so a small sprite
 * never inherits an oversized border, while enlarging keeps the border at the
 * width the user asked for. A 6% cap prevents an extreme value from swallowing
 * a tiny layer, and 1 px is the smallest meaningful PNG border.
 */
export function effectiveOutlineWidth(
  requested: number,
  width: number,
  height: number,
  referenceSize?: number,
): number {
  if (!(requested > 0)) return 0;
  const shortSide = Math.min(Math.max(1, width), Math.max(1, height));
  const reference = referenceSize && referenceSize > 0 ? Math.max(1, referenceSize) : shortSide;
  const scaled = requested * Math.min(1, shortSide / reference);
  const cap = Math.max(MIN_OUTLINE_WIDTH, shortSide * OUTLINE_MAX_RATIO);
  return Math.max(MIN_OUTLINE_WIDTH, Math.min(scaled, cap));
}

/**
 * Backfills reference sizes for projects created before outlines scaled with
 * their layer. Without this, the first resize would jump from an absolute to a
 * proportional border.
 */
export function ensureOutlineReferences(scene: Scene): Scene {
  let changed = false;
  const layers = scene.layers.map((layer) => {
    if (layer.type !== "image") return layer;
    if (layer.effects.outline.referenceSize) return layer;
    changed = true;
    return {
      ...layer,
      effects: {
        ...layer.effects,
        outline: {
          ...layer.effects.outline,
          // Old projects have no anchor. If the layer was shrunk below its
          // category's original size, anchor there so the border immediately
          // becomes proportionate instead of staying at the saved pixel width.
          referenceSize: Math.max(
            Math.min(layer.width, layer.height),
            defaultLayerHeight(layer.asset.category),
          ),
        },
      },
    };
  });
  return changed ? { ...scene, layers } : scene;
}
