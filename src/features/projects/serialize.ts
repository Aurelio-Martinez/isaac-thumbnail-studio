import { parseProjectFile, parseProjectJson } from "@/features/editor/schema";
import {
  SCENE_VERSION,
  createEmptyScene,
  makeId,
  type ProjectFile,
  type Scene,
} from "@/features/editor/types";
import {
  embedUploads,
  hydrateSceneUploads,
  restoreEmbeddedAssets,
  stripUploadUrls,
} from "@/features/assets/uploads";
import { ensureOutlineReferences } from "@/features/editor/effects";
import { migrateLegacyBundledAssets } from "@/features/projects/migrate";
import type { AssetRef } from "@/features/assets/types";

export function createProject(options: {
  name: string;
  scene?: Scene;
  id?: string;
  createdAt?: string;
}): ProjectFile {
  const now = new Date().toISOString();
  const project: ProjectFile = {
    schemaVersion: SCENE_VERSION,
    appId: "isaac-thumbnail-studio",
    id: options.id ?? makeId("project"),
    name: options.name.trim().slice(0, 80) || "Untitled thumbnail",
    createdAt: options.createdAt ?? now,
    updatedAt: now,
    scene: options.scene ? structuredClone(options.scene) : createEmptyScene(),
  };
  return project;
}

export function prepareProjectForStorage(project: ProjectFile): ProjectFile {
  return {
    ...project,
    name: project.name.trim().slice(0, 80) || "Untitled thumbnail",
    updatedAt: new Date().toISOString(),
    scene: stripUploadUrls(project.scene),
    embeddedAssets: undefined,
  };
}

export function projectToJson(project: ProjectFile): string {
  return JSON.stringify(project, null, 2);
}

export function collectUploadRefs(scene: Scene): AssetRef[] {
  const refs: AssetRef[] = [];
  if (scene.background.asset?.uploadId) refs.push(scene.background.asset);
  for (const layer of scene.layers) {
    if (layer.type === "image" && layer.asset.uploadId) refs.push(layer.asset);
  }
  return refs;
}

export async function createPortableProject(project: ProjectFile): Promise<{
  project: ProjectFile;
  missingUploads: string[];
}> {
  const scene = stripUploadUrls(project.scene);
  const { embedded, missing } = await embedUploads(project.scene);
  const portable: ProjectFile = {
    ...project,
    updatedAt: new Date().toISOString(),
    scene,
    ...(Object.keys(embedded).length > 0 ? { embeddedAssets: embedded } : {}),
  };
  const validation = parseProjectFile(portable);
  if (!validation.ok) {
    throw new Error(`Portable project validation failed: ${validation.error}`);
  }
  return {
    project: portable,
    missingUploads: collectUploadRefs(project.scene)
      .filter((ref) => ref.uploadId && missing.includes(ref.uploadId))
      .map((ref) => ref.name),
  };
}

export async function hydrateProjectUploads(project: ProjectFile): Promise<{
  project: ProjectFile;
  warnings: string[];
}> {
  const migrated = migrateLegacyBundledAssets(project.scene);
  const withOutlineReferences = ensureOutlineReferences(migrated.scene);
  const { scene, missing } = await hydrateSceneUploads(withOutlineReferences);
  const warnings = [...migrated.warnings];
  if (missing.length > 0) {
    warnings.push(
      `Missing uploaded image${missing.length === 1 ? "" : "s"} for: ${missing
        .map((entry) => entry.name)
        .slice(0, 5)
        .join(", ")}${missing.length > 5 ? "…" : ""}. Re-upload the image or delete those layers.`,
    );
  }
  return { project: { ...project, scene }, warnings };
}

export type ImportResult =
  { ok: true; project: ProjectFile; warnings: string[] } | { ok: false; error: string };

export async function importProjectJson(text: string): Promise<ImportResult> {
  const parsed = parseProjectJson(text);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const { project } = parsed;
  const warnings: string[] = [];
  const uploadRefs = collectUploadRefs(project.scene);

  if (project.embeddedAssets) {
    const restored = await restoreEmbeddedAssets(project.embeddedAssets, uploadRefs);
    if (restored.missing.length > 0) {
      warnings.push(
        `${restored.missing.length} embedded upload${restored.missing.length === 1 ? "" : "s"} could not be restored.`,
      );
    }
    if (restored.restored > 0) {
      warnings.push(
        `Restored ${restored.restored} embedded upload${restored.restored === 1 ? "" : "s"} into this browser.`,
      );
    }
  } else if (uploadRefs.length > 0) {
    warnings.push(
      "This project references uploaded images that were not embedded. They will only appear if they exist in this browser.",
    );
  }

  const hydrated = await hydrateProjectUploads({ ...project, embeddedAssets: undefined });
  warnings.push(...hydrated.warnings);
  return { ok: true, project: hydrated.project, warnings };
}

export function renameProject(project: ProjectFile, name: string): ProjectFile {
  return {
    ...project,
    name: name.trim().slice(0, 80) || "Untitled thumbnail",
    updatedAt: new Date().toISOString(),
  };
}

export function duplicateProject(project: ProjectFile): ProjectFile {
  const now = new Date().toISOString();
  return {
    ...structuredClone(project),
    id: makeId("project"),
    name: `${project.name} copy`.slice(0, 80),
    createdAt: now,
    updatedAt: now,
    embeddedAssets: undefined,
    scene: stripUploadUrls(project.scene),
  };
}
