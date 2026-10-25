import type { LayerPatch } from "@/features/editor/sceneOps";

export interface TextStylePreset {
  id: string;
  name: string;
  description: string;
  patch: LayerPatch;
}

/**
 * Original, studio-designed headline treatments. These do not reproduce any
 * particular creator's visual identity.
 */
export const TEXT_STYLE_PRESETS: TextStylePreset[] = [
  {
    id: "blockbuster",
    name: "Blockbuster",
    description: "Condensed cream caps with a heavy black outline.",
    patch: {
      fontFamily: "Anton",
      fontWeight: 400,
      color: "#f2ece0",
      effects: {
        outline: { enabled: true, color: "#0b070a", width: 10 },
        shadow: {
          enabled: true,
          color: "#000000",
          blur: 18,
          offsetX: 0,
          offsetY: 10,
          opacity: 0.65,
        },
        glow: { enabled: false },
      },
    },
  },
  {
    id: "comic-pop",
    name: "Comic pop",
    description: "Loose comic lettering with a violet rim.",
    patch: {
      fontFamily: "Bangers",
      fontWeight: 400,
      color: "#f0d27c",
      effects: {
        outline: { enabled: true, color: "#2b1f3d", width: 8 },
        shadow: {
          enabled: true,
          color: "#000000",
          blur: 14,
          offsetX: 4,
          offsetY: 7,
          opacity: 0.55,
        },
        glow: { enabled: true, color: "#8b6fd1", blur: 28, opacity: 0.4 },
      },
    },
  },
  {
    id: "clean-caption",
    name: "Clean caption",
    description: "Tight sans-serif for information, episode numbers, or jokes.",
    patch: {
      fontFamily: "Inter",
      fontWeight: 600,
      fontSize: 48,
      letterSpacing: 0,
      color: "#f2ece0",
      effects: {
        outline: { enabled: false },
        shadow: { enabled: true, color: "#000000", blur: 12, offsetX: 0, offsetY: 4, opacity: 0.7 },
        glow: { enabled: false },
      },
    },
  },
  {
    id: "pixel-tag",
    name: "Pixel tag",
    description: "Small gold pixel type with a hard outline.",
    patch: {
      fontFamily: "Press Start 2P",
      fontWeight: 400,
      fontSize: 28,
      letterSpacing: 2,
      color: "#d5aa4a",
      effects: {
        outline: { enabled: true, color: "#0a0a0c", width: 5 },
        shadow: { enabled: true, color: "#000000", blur: 8, offsetX: 2, offsetY: 3, opacity: 0.8 },
        glow: { enabled: false },
      },
    },
  },
];
