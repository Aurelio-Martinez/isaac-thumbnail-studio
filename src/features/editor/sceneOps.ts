import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  defaultLayerHeight,
  estimateTextHeight,
  makeId,
  type GlowEffect,
  type ImageLayer,
  type Layer,
  type LayerEffects,
  type OutlineEffect,
  type Scene,
  type ShadowEffect,
  type TextLayer,
} from "@/features/editor/types";
import { normalizeRotation } from "@/lib/utils";

export interface EffectsPatch {
  shadow?: Partial<ShadowEffect>;
  outline?: Partial<OutlineEffect>;
  glow?: Partial<GlowEffect>;
}

export interface LayerPatch {
  name?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  opacity?: number;
  visible?: boolean;
  locked?: boolean;
  flipX?: boolean;
  flipY?: boolean;
  text?: string;
  fontFamily?: TextLayer["fontFamily"];
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  align?: TextLayer["align"];
  lineHeight?: number;
  letterSpacing?: number;
  effects?: EffectsPatch;
}

export type AlignEdge = "left" | "center-x" | "right" | "top" | "middle-y" | "bottom";

function mergeEffects(current: LayerEffects, patch: EffectsPatch): LayerEffects {
  return {
    shadow: { ...current.shadow, ...patch.shadow },
    outline: { ...current.outline, ...patch.outline },
    glow: { ...current.glow, ...patch.glow },
  };
}

export function updateLayerInScene(scene: Scene, id: string, patch: LayerPatch): Scene {
  const index = scene.layers.findIndex((layer) => layer.id === id);
  if (index === -1) return scene;
  const current = scene.layers[index]!;
  const { effects, ...rest } = patch;
  let next = { ...current, ...rest } as Layer;
  let nextEffects = effects ? mergeEffects(current.effects, effects) : current.effects;

  if (current.type === "image") {
    const oldShort = Math.min(current.width, current.height);
    const newShort = Math.min(next.width, next.height);
    const outline = nextEffects.outline;
    // Changing outline width anchors it to the current layer size. A plain
    // resize keeps the reference and therefore scales the border proportionally.
    if (effects?.outline?.width !== undefined) {
      nextEffects = {
        ...nextEffects,
        outline: { ...outline, referenceSize: newShort },
      };
    } else if (!outline.referenceSize) {
      nextEffects = {
        ...nextEffects,
        outline: {
          ...outline,
          referenceSize: Math.max(oldShort, defaultLayerHeight(current.asset.category)),
        },
      };
    }
  }

  next = { ...next, effects: nextEffects } as Layer;
  if (
    next.type === "text" &&
    (patch.text !== undefined ||
      patch.fontSize !== undefined ||
      patch.width !== undefined ||
      patch.lineHeight !== undefined ||
      patch.fontFamily !== undefined ||
      patch.fontWeight !== undefined ||
      patch.letterSpacing !== undefined)
  ) {
    const textLayer = next as TextLayer;
    textLayer.height = Math.max(
      textLayer.fontSize * textLayer.lineHeight,
      estimateTextHeight(textLayer),
    );
  }
  const layers = scene.layers.slice();
  layers[index] = next;
  return { ...scene, layers };
}

export function addLayerToScene(scene: Scene, layer: Layer): Scene {
  return { ...scene, layers: [...scene.layers, layer] };
}

export function removeLayersFromScene(scene: Scene, ids: string[]): Scene {
  const removing = new Set(ids);
  return { ...scene, layers: scene.layers.filter((layer) => !removing.has(layer.id)) };
}

export function duplicateLayersInScene(
  scene: Scene,
  ids: string[],
): { scene: Scene; ids: string[] } {
  const selected = new Set(ids);
  const clones: Layer[] = [];
  for (const layer of scene.layers) {
    if (!selected.has(layer.id)) continue;
    const clone = structuredClone(layer);
    clone.id = makeId(layer.type === "text" ? "text" : "layer");
    clone.name = `${layer.name} copy`.slice(0, 120);
    clone.x += 24;
    clone.y += 24;
    clone.locked = false;
    clones.push(clone);
  }
  if (clones.length === 0) return { scene, ids: [] };
  return {
    scene: { ...scene, layers: [...scene.layers, ...clones] },
    ids: clones.map((layer) => layer.id),
  };
}

/** delta > 0 moves the layer up in z-order (towards the viewer). */
export function reorderLayerInScene(scene: Scene, id: string, delta: number): Scene {
  const index = scene.layers.findIndex((layer) => layer.id === id);
  if (index === -1) return scene;
  const target = Math.max(0, Math.min(scene.layers.length - 1, index + delta));
  if (target === index) return scene;
  const layers = scene.layers.slice();
  const [layer] = layers.splice(index, 1);
  if (!layer) return scene;
  layers.splice(target, 0, layer);
  return { ...scene, layers };
}

export function moveLayerToIndex(scene: Scene, id: string, targetIndex: number): Scene {
  const index = scene.layers.findIndex((layer) => layer.id === id);
  if (index === -1) return scene;
  const target = Math.max(0, Math.min(scene.layers.length - 1, targetIndex));
  if (target === index) return scene;
  const layers = scene.layers.slice();
  const [layer] = layers.splice(index, 1);
  if (!layer) return scene;
  layers.splice(target, 0, layer);
  return { ...scene, layers };
}

export function bringToFront(scene: Scene, id: string): Scene {
  return moveLayerToIndex(scene, id, scene.layers.length - 1);
}

export function sendToBack(scene: Scene, id: string): Scene {
  return moveLayerToIndex(scene, id, 0);
}

export function alignLayer(layer: Layer, edge: AlignEdge): Layer {
  const halfWidth = layer.width / 2;
  const halfHeight = layer.height / 2;
  switch (edge) {
    case "left":
      return { ...layer, x: halfWidth };
    case "center-x":
      return { ...layer, x: CANVAS_WIDTH / 2 };
    case "right":
      return { ...layer, x: CANVAS_WIDTH - halfWidth };
    case "top":
      return { ...layer, y: halfHeight };
    case "middle-y":
      return { ...layer, y: CANVAS_HEIGHT / 2 };
    case "bottom":
      return { ...layer, y: CANVAS_HEIGHT - halfHeight };
  }
}

export function fitLayerToCanvas(layer: Layer, margin = 48): Layer {
  const maxWidth = CANVAS_WIDTH - margin * 2;
  const maxHeight = CANVAS_HEIGHT - margin * 2;
  const scale = Math.min(1, maxWidth / layer.width, maxHeight / layer.height);
  return {
    ...layer,
    width: layer.width * scale,
    height: layer.height * scale,
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT / 2,
  };
}

export function setLayerRotation(layer: Layer, rotation: number): Layer {
  return { ...layer, rotation: normalizeRotation(rotation) };
}

export function toggleLayerFlag(scene: Scene, id: string, key: "visible" | "locked"): Scene {
  const layer = scene.layers.find((entry) => entry.id === id);
  if (!layer) return scene;
  return updateLayerInScene(scene, id, { [key]: !layer[key] });
}

export function isOverLayerLimit(scene: Scene, limit: number): boolean {
  return scene.layers.length >= limit;
}

/** The bounding rectangle of a center-anchored layer, ignoring rotation. */
export function layerBounds(layer: Layer): {
  left: number;
  top: number;
  right: number;
  bottom: number;
} {
  return {
    left: layer.x - layer.width / 2,
    top: layer.y - layer.height / 2,
    right: layer.x + layer.width / 2,
    bottom: layer.y + layer.height / 2,
  };
}

export function imageLayerWithSize(
  layer: ImageLayer,
  height: number,
  maxWidth = CANVAS_WIDTH,
): ImageLayer {
  const aspect = layer.asset.width / layer.asset.height || 1;
  const width = Math.min(maxWidth, Math.max(12, height * aspect));
  return { ...layer, height, width };
}
