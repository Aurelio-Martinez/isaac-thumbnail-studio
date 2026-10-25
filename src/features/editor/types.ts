import { APP_CONFIG } from "@/config";
import type { AssetCategory, AssetRef } from "@/features/assets/types";

export const CANVAS_WIDTH = APP_CONFIG.canvasWidth;
export const CANVAS_HEIGHT = APP_CONFIG.canvasHeight;
export const SCENE_VERSION = 1 as const;

export const FONT_FAMILIES = [
  {
    id: "Anton",
    label: "Anton",
    kind: "Headline",
    weights: [400],
    fallback: "Impact, sans-serif",
  },
  {
    id: "Bebas Neue",
    label: "Bebas Neue",
    kind: "Condensed",
    weights: [400],
    fallback: "Oswald, sans-serif",
  },
  {
    id: "Bangers",
    label: "Bangers",
    kind: "Comic",
    weights: [400],
    fallback: "Comic Sans MS, cursive",
  },
  {
    id: "Inter",
    label: "Inter",
    kind: "Clean",
    weights: [400, 600, 700, 800],
    fallback: "system-ui, sans-serif",
  },
  {
    id: "Press Start 2P",
    label: "Press Start 2P",
    kind: "Pixel",
    weights: [400],
    fallback: "monospace",
  },
] as const;

export type FontFamilyId = (typeof FONT_FAMILIES)[number]["id"];
export const FONT_FAMILY_IDS = FONT_FAMILIES.map((font) => font.id) as [
  FontFamilyId,
  ...FontFamilyId[],
];

export interface ShadowEffect {
  enabled: boolean;
  color: string;
  blur: number;
  offsetX: number;
  offsetY: number;
  opacity: number;
}

export interface OutlineEffect {
  enabled: boolean;
  color: string;
  width: number;
  /** Short side of the layer when the width was chosen, for proportional scale-down. */
  referenceSize?: number;
}

export interface GlowEffect {
  enabled: boolean;
  color: string;
  blur: number;
  opacity: number;
}

export interface LayerEffects {
  shadow: ShadowEffect;
  outline: OutlineEffect;
  glow: GlowEffect;
}

export interface BaseLayer {
  id: string;
  type: "image" | "text";
  name: string;
  /** Center point on the logical canvas. */
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
}

export interface ImageLayer extends BaseLayer {
  type: "image";
  asset: AssetRef;
  effects: LayerEffects;
  flipX: boolean;
  flipY: boolean;
}

export interface TextLayer extends BaseLayer {
  type: "text";
  text: string;
  fontFamily: FontFamilyId;
  fontSize: number;
  fontWeight: number;
  color: string;
  align: "left" | "center" | "right";
  lineHeight: number;
  letterSpacing: number;
  effects: LayerEffects;
}

export type Layer = ImageLayer | TextLayer;

export interface SceneBackground {
  mode: "color" | "image" | "transparent";
  color: string;
  asset: AssetRef | null;
  opacity: number;
  fit: "cover" | "contain";
  dim: number;
  vignette: boolean;
}

export interface Scene {
  version: typeof SCENE_VERSION;
  background: SceneBackground;
  layers: Layer[];
}

export interface ProjectMeta {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectFile extends ProjectMeta {
  schemaVersion: typeof SCENE_VERSION;
  appId: "isaac-thumbnail-studio";
  scene: Scene;
  /** Only present in portable downloads. Keyed by uploadId. */
  embeddedAssets?: Record<string, string>;
}

export interface Guide {
  orientation: "vertical" | "horizontal";
  position: number;
  kind: "center" | "edge";
}

export const DEFAULT_EFFECTS: LayerEffects = {
  shadow: {
    enabled: true,
    color: "#000000",
    blur: 18,
    offsetX: 6,
    offsetY: 10,
    opacity: 0.55,
  },
  outline: { enabled: true, color: "#0a0a0c", width: 4 },
  glow: { enabled: false, color: "#d5aa4a", blur: 32, opacity: 0.6 },
};

export function makeId(prefix: string): string {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${uuid}`;
}

export function createDefaultBackground(): SceneBackground {
  return {
    mode: "transparent",
    color: "#17141c",
    asset: null,
    opacity: 1,
    fit: "cover",
    dim: 0,
    vignette: false,
  };
}

export function createBlankScene(): Scene {
  return {
    version: SCENE_VERSION,
    background: createDefaultBackground(),
    layers: [],
  };
}

export function createEmptyScene(): Scene {
  return {
    version: SCENE_VERSION,
    background: createDefaultBackground(),
    layers: [],
  };
}

const CATEGORY_BASE_HEIGHT: Record<AssetCategory, number> = {
  characters: 360,
  collectibles: 120,
  "active-items": 128,
  trinkets: 112,
  cards: 128,
  pills: 112,
  backgrounds: 480,
  bosses: 260,
  uploads: 240,
};

export function defaultLayerHeight(category: AssetCategory): number {
  return CATEGORY_BASE_HEIGHT[category] ?? 160;
}

export function createImageLayer(asset: AssetRef, overrides: Partial<ImageLayer> = {}): ImageLayer {
  const baseHeight = defaultLayerHeight(asset.category);
  const aspect = asset.width > 0 && asset.height > 0 ? asset.width / asset.height : 1;
  const height = baseHeight;
  const width = Math.max(24, Math.min(CANVAS_WIDTH, height * aspect));
  const base: ImageLayer = {
    id: makeId("layer"),
    type: "image",
    name: asset.name,
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT / 2,
    width,
    height,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    asset,
    effects: structuredCloneEffect(DEFAULT_EFFECTS),
    flipX: false,
    flipY: false,
  };
  const merged: ImageLayer = { ...base, ...overrides };
  merged.effects = structuredCloneEffect(merged.effects);
  merged.effects.outline = {
    ...merged.effects.outline,
    referenceSize: Math.min(merged.width, merged.height),
  };
  return merged;
}

export function createTextLayer(overrides: Partial<TextLayer> = {}): TextLayer {
  const base: TextLayer = {
    id: makeId("text"),
    type: "text",
    name: "Headline",
    x: CANVAS_WIDTH / 2,
    y: 120,
    width: 760,
    height: 116,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    text: "NEW RUN",
    fontFamily: "Anton",
    fontSize: 104,
    fontWeight: 400,
    color: "#f2ece0",
    align: "center",
    lineHeight: 1,
    letterSpacing: 1,
    effects: {
      shadow: { enabled: true, color: "#000000", blur: 16, offsetX: 5, offsetY: 7, opacity: 0.6 },
      outline: { enabled: true, color: "#0a0a0c", width: 7 },
      glow: { enabled: false, color: "#d5aa4a", blur: 26, opacity: 0.55 },
    },
  };
  return { ...base, ...overrides };
}

export function structuredCloneEffect(effects: LayerEffects): LayerEffects {
  return {
    shadow: { ...effects.shadow },
    outline: { ...effects.outline },
    glow: { ...effects.glow },
  };
}

export function estimateTextHeight(
  layer: Pick<TextLayer, "text" | "fontSize" | "lineHeight" | "width">,
): number {
  const explicitLines = layer.text.split("\n").length;
  const approxCharsPerLine = Math.max(4, Math.floor(layer.width / (layer.fontSize * 0.52)));
  const wrapped = layer.text
    .split("\n")
    .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / approxCharsPerLine)), 0);
  return Math.max(
    layer.fontSize * layer.lineHeight,
    Math.max(explicitLines, wrapped) * layer.fontSize * layer.lineHeight * 1.02,
  );
}

export function layerTypeLabel(layer: Layer): string {
  return layer.type === "text" ? "Text" : "Image";
}

export function findLayer(scene: Scene, id: string): Layer | undefined {
  return scene.layers.find((layer) => layer.id === id);
}

export function isImageLayer(layer: Layer): layer is ImageLayer {
  return layer.type === "image";
}

export function isTextLayer(layer: Layer): layer is TextLayer {
  return layer.type === "text";
}
