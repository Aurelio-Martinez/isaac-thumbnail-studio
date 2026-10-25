import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  estimateTextHeight,
  type ImageLayer,
  type Layer,
  type Scene,
  type TextLayer,
} from "@/features/editor/types";
import { moveLayerToIndex } from "@/features/editor/sceneOps";

export type LayoutPresetId =
  "hero-left" | "hero-center" | "featured-item" | "item-grid" | "text-led" | "minimal";

export type TextPosition = "top" | "left" | "center" | "bottom" | "auto";

export interface PresetOptions {
  itemScale: number;
  itemSpacing: number;
  characterScale: number;
  textPosition: TextPosition;
}

export const DEFAULT_PRESET_OPTIONS: PresetOptions = {
  itemScale: 1,
  itemSpacing: 1,
  characterScale: 1,
  textPosition: "auto",
};

export const LAYOUT_PRESETS: Array<{
  id: LayoutPresetId;
  name: string;
  description: string;
}> = [
  {
    id: "hero-left",
    name: "Hero left",
    description: "Character left, item cluster right, headline across the top.",
  },
  {
    id: "hero-center",
    name: "Hero center",
    description: "Large central character with items framing both sides.",
  },
  {
    id: "featured-item",
    name: "Featured item",
    description: "One hero item, supporting pickups, character tucked to the side.",
  },
  {
    id: "item-grid",
    name: "Character + grid",
    description: "Character in a corner, tidy grid of items, top headline.",
  },
  {
    id: "text-led",
    name: "Text-led",
    description: "Big headline first, character right, items as a bottom accent.",
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "One character, one or two items, lots of breathing room.",
  },
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function resizeImage(layer: ImageLayer, height: number, maxWidth = 640): ImageLayer {
  const aspect = layer.asset.width / layer.asset.height || 1;
  let nextHeight = height;
  let width = nextHeight * aspect;
  if (width > maxWidth) {
    width = maxWidth;
    nextHeight = width / aspect;
  }
  return { ...layer, height: Math.round(nextHeight), width: Math.round(width) };
}

function primaryCharacter(layers: Layer[]): ImageLayer | null {
  return (
    layers.find(
      (layer): layer is ImageLayer =>
        layer.type === "image" && layer.asset.category === "characters",
    ) ?? null
  );
}

function itemsOf(layers: Layer[]): ImageLayer[] {
  return layers.filter(
    (layer): layer is ImageLayer =>
      layer.type === "image" &&
      layer.asset.category !== "characters" &&
      layer.asset.category !== "backgrounds",
  );
}

function primaryText(layers: Layer[]): TextLayer | null {
  return layers.find((layer): layer is TextLayer => layer.type === "text") ?? null;
}

function mapLayers(scene: Scene, updates: Map<string, Layer>): Scene {
  return {
    ...scene,
    layers: scene.layers.map((layer) => updates.get(layer.id) ?? layer),
  };
}

function moveToTop(scene: Scene, id: string): Scene {
  return moveLayerToIndex(scene, id, scene.layers.length - 1);
}

function moveToBottom(scene: Scene, id: string): Scene {
  return moveLayerToIndex(scene, id, 0);
}

function placeText(
  scene: Scene,
  text: TextLayer | null,
  position: TextPosition,
  fallback: Exclude<TextPosition, "auto">,
): Scene {
  if (!text) return scene;
  const chosen = position === "auto" ? fallback : position;
  const height = Math.max(
    estimateTextHeight({
      text: text.text,
      fontSize: text.fontSize,
      lineHeight: text.lineHeight,
      width: text.width,
    }),
    text.fontSize * text.lineHeight,
  );
  let width = text.width;
  let align: TextLayer["align"] = "center";
  let x = CANVAS_WIDTH / 2;
  let y = 70 + height / 2;

  switch (chosen) {
    case "top":
      width = Math.min(1140, Math.max(480, text.width));
      y = 64 + height / 2;
      align = "center";
      break;
    case "bottom":
      width = Math.min(1140, Math.max(480, text.width));
      y = CANVAS_HEIGHT - 64 - height / 2;
      align = "center";
      break;
    case "left":
      width = Math.min(680, Math.max(360, text.width));
      x = 56 + width / 2;
      y = CANVAS_HEIGHT / 2 - 20;
      align = "left";
      break;
    case "center":
      width = Math.min(920, Math.max(480, text.width));
      y = CANVAS_HEIGHT / 2 - 10;
      align = "center";
      break;
  }

  const next: TextLayer = {
    ...text,
    width,
    height: Math.max(height, estimateTextHeight({ ...text, width })),
    x: clamp(x, width / 2, CANVAS_WIDTH - width / 2),
    y: clamp(y, height / 2, CANVAS_HEIGHT - height / 2),
    align,
  };
  const updated = mapLayers(scene, new Map([[next.id, next]]));
  return moveToTop(updated, text.id);
}

export function applyLayoutPreset(
  scene: Scene,
  presetId: LayoutPresetId,
  options: PresetOptions = DEFAULT_PRESET_OPTIONS,
): { scene: Scene; warnings: string[] } {
  const warnings: string[] = [];
  const character = primaryCharacter(scene.layers);
  const items = itemsOf(scene.layers);
  const text = primaryText(scene.layers);
  const itemScale = clamp(options.itemScale, 0.5, 1.8);
  const spacing = clamp(options.itemSpacing, 0.5, 2);
  const characterScale = clamp(options.characterScale, 0.5, 1.8);

  if (!character) {
    warnings.push("Add a character layer to complete this hero composition.");
  }
  if (items.length === 0) {
    warnings.push("Add a few items to fill the composition.");
  }
  if (!text) {
    warnings.push("Add a text layer to place a headline automatically.");
  }

  let next = scene;
  const updates = new Map<string, Layer>();
  const characterLayer = character;

  if (characterLayer) {
    const height = clamp(360 * characterScale, 200, 600);
    updates.set(
      characterLayer.id,
      presetId === "hero-center"
        ? {
            ...characterLayer,
            ...resizeImage(characterLayer, height, 700),
            x: CANVAS_WIDTH / 2,
            y: 420,
          }
        : presetId === "featured-item"
          ? {
              ...characterLayer,
              ...resizeImage(characterLayer, 250 * characterScale, 340),
              x: 230,
              y: 560,
            }
          : presetId === "item-grid"
            ? {
                ...characterLayer,
                ...resizeImage(characterLayer, 260 * characterScale, 360),
                x: 260,
                y: 300,
              }
            : presetId === "text-led"
              ? {
                  ...characterLayer,
                  ...resizeImage(characterLayer, 420 * characterScale, 460),
                  x: 1040,
                  y: 440,
                }
              : presetId === "minimal"
                ? {
                    ...characterLayer,
                    ...resizeImage(characterLayer, 520 * characterScale, 480),
                    x: 470,
                    y: 420,
                  }
                : {
                    ...characterLayer,
                    ...resizeImage(characterLayer, 500 * characterScale, 460),
                    x: 290,
                    y: 400,
                  },
    );
  }

  if (presetId === "hero-left" || presetId === "hero-center") {
    const cols = 2;
    const cellWidth = 196 * Math.max(0.85, itemScale);
    const cellHeight = 178 * Math.max(0.85, itemScale);
    const gapX = 36 * spacing;
    const gapY = 34 * spacing;
    const totalWidth = cols * cellWidth + (cols - 1) * gapX;
    if (presetId === "hero-left") {
      const startX = 1136 - totalWidth + cellWidth / 2;
      const rows = Math.ceil(items.length / cols);
      const totalHeight = rows * cellHeight + Math.max(0, rows - 1) * gapY;
      const startY = 400 - totalHeight / 2 + cellHeight / 2;
      items.forEach((item, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const resized = resizeImage(item, 118 * itemScale, 220);
        updates.set(item.id, {
          ...resized,
          x: clamp(
            startX + col * (cellWidth + gapX),
            resized.width / 2 + 24,
            CANVAS_WIDTH - resized.width / 2 - 24,
          ),
          y: clamp(
            startY + row * (cellHeight + gapY),
            resized.height / 2 + 24,
            CANVAS_HEIGHT - resized.height / 2 - 24,
          ),
        });
      });
    } else {
      const left = items.filter((_, index) => index % 2 === 0);
      const right = items.filter((_, index) => index % 2 === 1);
      const placeColumn = (column: ImageLayer[], x: number) => {
        const rows = column.length;
        column.forEach((item, index) => {
          const resized = resizeImage(item, 126 * itemScale, 210);
          const spread = 300 * spacing;
          const y = rows <= 1 ? 420 : 300 + (index / (rows - 1)) * spread;
          updates.set(item.id, {
            ...resized,
            x,
            y: clamp(y, resized.height / 2 + 20, CANVAS_HEIGHT - resized.height / 2 - 20),
          });
        });
      };
      placeColumn(left, 140);
      placeColumn(right, 1140);
    }
  } else if (presetId === "featured-item") {
    const featured = items[items.length - 1];
    const support = items.slice(0, -1);
    if (featured) {
      const resized = resizeImage(featured, 390 * itemScale, 560);
      updates.set(featured.id, { ...resized, x: 850, y: 400 });
    }
    support.slice(0, 4).forEach((item, index) => {
      const resized = resizeImage(item, 96 * itemScale, 180);
      updates.set(item.id, { ...resized, x: 190, y: 180 + index * 125 });
    });
  } else if (presetId === "item-grid") {
    const cols = 3;
    const cellWidth = 210;
    const cellHeight = 180;
    const gapX = 26 * spacing;
    const gapY = 24 * spacing;
    const rows = Math.ceil(items.length / cols);
    const startX = 780;
    const startY = 380 - ((rows - 1) * (cellHeight + gapY)) / 2;
    items.forEach((item, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const resized = resizeImage(item, 112 * itemScale, 180);
      updates.set(item.id, {
        ...resized,
        x: clamp(
          startX + col * (cellWidth + gapX),
          resized.width / 2 + 20,
          CANVAS_WIDTH - resized.width / 2 - 20,
        ),
        y: clamp(
          startY + row * (cellHeight + gapY),
          resized.height / 2 + 20,
          CANVAS_HEIGHT - resized.height / 2 - 20,
        ),
      });
    });
  } else if (presetId === "text-led") {
    const visibleItems = items.slice(0, 7);
    const totalWidth = visibleItems.length * 112;
    const startX = 340 - Math.min(totalWidth, 540) / 2 + 60;
    visibleItems.forEach((item, index) => {
      const resized = resizeImage(item, 96 * itemScale, 150);
      updates.set(item.id, {
        ...resized,
        x: clamp(startX + index * 116 * spacing, resized.width / 2 + 20, 700),
        y: 600,
      });
    });
    items.slice(7).forEach((item, index) => {
      const resized = resizeImage(item, 70 * itemScale, 110);
      updates.set(item.id, { ...resized, x: 80, y: 60 + index * 10 });
    });
  } else if (presetId === "minimal") {
    const [first, second, ...extra] = items;
    if (first) {
      const resized = resizeImage(first, 178 * itemScale, 260);
      updates.set(first.id, { ...resized, x: 950, y: 300 });
    }
    if (second) {
      const resized = resizeImage(second, 150 * itemScale, 240);
      updates.set(second.id, { ...resized, x: 1100, y: 500 });
    }
    extra.forEach((item, index) => {
      const resized = resizeImage(item, 62 * itemScale, 90);
      updates.set(item.id, { ...resized, x: 760 + index * 90, y: 648 });
    });
  }

  next = mapLayers(next, updates);

  if (presetId === "hero-center" && characterLayer) {
    next = moveToBottom(next, characterLayer.id);
  }
  if (presetId === "featured-item" && items.length > 0) {
    const featured = items[items.length - 1];
    if (featured) next = moveToTop(next, featured.id);
  }

  const fallbackTextPosition: Exclude<TextPosition, "auto"> =
    presetId === "text-led" ? "left" : "top";
  next = placeText(next, text, options.textPosition, fallbackTextPosition);

  return { scene: next, warnings };
}
