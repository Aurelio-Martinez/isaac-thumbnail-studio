import { z } from "zod";
import { APP_CONFIG } from "@/config";
import { ASSET_CATEGORIES } from "@/features/assets/types";
import { FONT_FAMILY_IDS, SCENE_VERSION, type ProjectFile } from "@/features/editor/types";
import { isAllowedAssetUrl, isLocalAssetUrl } from "../../../shared/assetSources";

const COLOR_REGEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const ID_REGEX = /^[A-Za-z0-9._:-]{1,120}$/;

const colorSchema = z.string().regex(COLOR_REGEX, "Use a hex color such as #d5aa4a.").max(9);
const idSchema = z.string().regex(ID_REGEX, "Contains unsupported characters.").max(120);

const safeImageUrlSchema = z
  .string()
  .max(2_000_000)
  .refine(
    (value) => value === "" || isLocalAssetUrl(value) || isAllowedAssetUrl(value),
    "Image must be a local asset, an upload, or an allowlisted wiki image URL.",
  );

const assetRefSchema = z
  .object({
    id: z.string().min(1).max(200),
    name: z.string().min(1).max(200),
    category: z.enum(ASSET_CATEGORIES),
    imageUrl: safeImageUrlSchema,
    thumbnailUrl: safeImageUrlSchema,
    sourceUrl: z
      .string()
      .max(2048)
      .refine(
        // /media paths are accepted only so projects saved by earlier bundled-art
        // builds can be parsed, migrated, and warned about instead of discarded.
        (value) => value === "" || value.startsWith("https://") || value.startsWith("/media/"),
        "Source links must be https URLs.",
      ),
    sourceName: z.string().max(200),
    licenseStatus: z.enum(["original", "copyrighted", "public-domain", "unknown"]),
    attribution: z.string().max(600),
    width: z.number().min(1).max(20_000),
    height: z.number().min(1).max(20_000),
    providerId: z.string().min(1).max(50),
    uploadId: z.string().max(120).optional(),
  })
  .refine((asset) => asset.imageUrl.length > 0 || Boolean(asset.uploadId), {
    message: "An asset needs an image URL or an upload reference.",
    path: ["imageUrl"],
  });

const shadowSchema = z.object({
  enabled: z.boolean(),
  color: colorSchema,
  blur: z.number().min(0).max(200),
  offsetX: z.number().min(-200).max(200),
  offsetY: z.number().min(-200).max(200),
  opacity: z.number().min(0).max(1),
});

const outlineSchema = z.object({
  enabled: z.boolean(),
  color: colorSchema,
  width: z.number().min(0).max(64),
  referenceSize: z.number().min(1).max(20_000).optional(),
});

const glowSchema = z.object({
  enabled: z.boolean(),
  color: colorSchema,
  blur: z.number().min(0).max(200),
  opacity: z.number().min(0).max(1),
});

const effectsSchema = z.object({
  shadow: shadowSchema,
  outline: outlineSchema,
  glow: glowSchema,
});

const baseLayerShape = {
  id: idSchema,
  name: z.string().min(1).max(120),
  x: z.number().min(-10_000).max(10_000),
  y: z.number().min(-10_000).max(10_000),
  width: z.number().min(1).max(4000),
  height: z.number().min(1).max(4000),
  rotation: z.number().min(-3600).max(3600),
  opacity: z.number().min(0).max(1),
  visible: z.boolean(),
  locked: z.boolean(),
};

const imageLayerSchema = z.object({
  ...baseLayerShape,
  type: z.literal("image"),
  asset: assetRefSchema,
  effects: effectsSchema,
  flipX: z.boolean(),
  flipY: z.boolean(),
});

const textLayerSchema = z.object({
  ...baseLayerShape,
  type: z.literal("text"),
  text: z.string().max(500),
  fontFamily: z.enum(FONT_FAMILY_IDS),
  fontSize: z.number().min(4).max(600),
  fontWeight: z.number().min(100).max(900),
  color: colorSchema,
  align: z.enum(["left", "center", "right"]),
  lineHeight: z.number().min(0.5).max(4),
  letterSpacing: z.number().min(-50).max(200),
  effects: effectsSchema,
});

const layerSchema = z.discriminatedUnion("type", [imageLayerSchema, textLayerSchema]);

const backgroundSchema = z.object({
  mode: z.enum(["color", "image", "transparent"]),
  color: colorSchema,
  asset: assetRefSchema.nullable(),
  opacity: z.number().min(0).max(1),
  fit: z.enum(["cover", "contain"]),
  dim: z.number().min(0).max(1),
  vignette: z.boolean(),
});

const dataUrlSchema = z
  .string()
  .max(12_000_000)
  .refine(
    (value) => /^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(value),
    "Embedded assets must be base64 images.",
  );

const embeddedAssetsSchema = z
  .record(z.string().max(120), dataUrlSchema)
  .refine((record) => Object.keys(record).length <= 30, "At most 30 embedded uploads are allowed.");

const timestampSchema = z.string().min(10).max(40);

export const projectFileSchema: z.ZodType<ProjectFile> = z.object({
  schemaVersion: z.literal(SCENE_VERSION),
  appId: z.literal("isaac-thumbnail-studio"),
  id: idSchema,
  name: z.string().min(1).max(80),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  scene: z.object({
    version: z.literal(SCENE_VERSION),
    background: backgroundSchema,
    layers: z.array(layerSchema).max(APP_CONFIG.maxLayers),
  }),
  embeddedAssets: embeddedAssetsSchema.optional(),
});

export type ProjectParseResult = { ok: true; project: ProjectFile } | { ok: false; error: string };

function formatIssues(error: z.ZodError): string {
  const issues = error.issues.slice(0, 6).map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "project";
    return `${path}: ${issue.message}`;
  });
  return issues.join(" · ");
}

export function parseProjectFile(input: unknown): ProjectParseResult {
  const parsed = projectFileSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: `This project file is not valid. ${formatIssues(parsed.error)}`,
    };
  }
  const layerIds = new Set<string>();
  for (const layer of parsed.data.scene.layers) {
    if (layerIds.has(layer.id)) {
      return { ok: false, error: "This project file contains duplicate layer IDs." };
    }
    layerIds.add(layer.id);
  }
  return { ok: true, project: parsed.data };
}

export function parseProjectJson(text: string): ProjectParseResult {
  if (text.length > APP_CONFIG.maxImportBytes) {
    return {
      ok: false,
      error: `That file is larger than the ${Math.round(APP_CONFIG.maxImportBytes / 1024 / 1024)} MB import limit.`,
    };
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file is not valid JSON." };
  }
  return parseProjectFile(value);
}

export const layersSchema = z.array(layerSchema).max(APP_CONFIG.maxLayers);
