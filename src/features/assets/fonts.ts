import { FONT_FAMILIES, type Scene } from "@/features/editor/types";

const EXPECTED_SPECS = [
  '400 32px "Anton"',
  '400 32px "Bebas Neue"',
  '400 32px "Bangers"',
  '400 32px "Inter"',
  '600 32px "Inter"',
  '700 32px "Inter"',
  '800 32px "Inter"',
  '400 32px "Press Start 2P"',
];

let loadedPromise: Promise<void> | null = null;

export function loadBundledFonts(): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) return Promise.resolve();
  if (loadedPromise) return loadedPromise;
  loadedPromise = (async () => {
    try {
      await Promise.all(EXPECTED_SPECS.map((spec) => document.fonts.load(spec)));
      await document.fonts.ready;
    } catch {
      // Font loading failures should not block the editor; Konva falls back.
    }
  })();
  return loadedPromise;
}

export async function ensureSceneFonts(scene: Scene): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  const needed = new Set<string>();
  for (const layer of scene.layers) {
    if (layer.type !== "text" || !layer.visible) continue;
    needed.add(`${layer.fontWeight} 48px "${layer.fontFamily}"`);
  }
  await Promise.all([...needed].map((spec) => document.fonts.load(spec)));
  await document.fonts.ready;
}

export function fontStack(family: string): string {
  const entry = FONT_FAMILIES.find((font) => font.id === family);
  return entry ? `"${entry.id}", ${entry.fallback}` : `"Inter", sans-serif`;
}
