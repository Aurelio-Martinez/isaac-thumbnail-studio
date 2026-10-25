import { STORAGE_KEYS } from "@/config";
import { prepareProjectForStorage } from "@/features/projects/serialize";
import { parseProjectFile } from "@/features/editor/schema";
import type { ProjectFile } from "@/features/editor/types";

export const PROJECT_LIMIT = 25;

export interface StorageResult {
  ok: boolean;
  error?: string;
  code?: "quota" | "unavailable" | "limit" | "unknown";
  updatedAt?: string;
}

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    const probe = "__its_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

export function isStorageAvailable(): boolean {
  return storage() !== null;
}

export function readProjectLibrary(): { projects: ProjectFile[]; warnings: string[] } {
  const store = storage();
  if (!store) {
    return {
      projects: [],
      warnings: ["Browser storage is unavailable. Projects cannot be saved here."],
    };
  }
  const raw = store.getItem(STORAGE_KEYS.projects);
  if (!raw) return { projects: [], warnings: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      projects: [],
      warnings: ["The saved project list is corrupted and could not be read."],
    };
  }
  if (!Array.isArray(parsed)) {
    return { projects: [], warnings: ["The saved project list is in an unexpected format."] };
  }
  const projects: ProjectFile[] = [];
  let skipped = 0;
  for (const entry of parsed) {
    const result = parseProjectFile(entry);
    if (result.ok) projects.push(result.project);
    else skipped += 1;
  }
  projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return {
    projects,
    warnings:
      skipped > 0
        ? [`Skipped ${skipped} saved project${skipped === 1 ? "" : "s"} that failed validation.`]
        : [],
  };
}

export function writeProject(project: ProjectFile): StorageResult {
  const store = storage();
  if (!store) {
    return {
      ok: false,
      code: "unavailable",
      error: "Browser storage is unavailable. Export this project as JSON to keep it.",
    };
  }
  const { projects } = readProjectLibrary();
  const existingIndex = projects.findIndex((entry) => entry.id === project.id);
  const prepared = prepareProjectForStorage(project);
  if (existingIndex === -1 && projects.length >= PROJECT_LIMIT) {
    return {
      ok: false,
      code: "limit",
      error: `You have ${PROJECT_LIMIT} local projects. Delete one or export a project as JSON first.`,
    };
  }
  const next =
    existingIndex === -1
      ? [prepared, ...projects]
      : projects.map((entry) => (entry.id === project.id ? prepared : entry));
  next.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  try {
    store.setItem(STORAGE_KEYS.projects, JSON.stringify(next));
    return { ok: true, updatedAt: prepared.updatedAt };
  } catch (error) {
    const name = (error as { name?: string }).name ?? "";
    if (name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED") {
      return {
        ok: false,
        code: "quota",
        error:
          "Browser storage is full. Export this project as JSON, then delete older projects from the project manager.",
      };
    }
    return { ok: false, code: "unknown", error: "The project could not be saved to this browser." };
  }
}

export function getProject(id: string): ProjectFile | null {
  return readProjectLibrary().projects.find((project) => project.id === id) ?? null;
}

export function deleteProjectFromLibrary(id: string): StorageResult {
  const store = storage();
  if (!store) {
    return { ok: false, code: "unavailable", error: "Browser storage is unavailable." };
  }
  const { projects } = readProjectLibrary();
  const next = projects.filter((project) => project.id !== id);
  try {
    store.setItem(STORAGE_KEYS.projects, JSON.stringify(next));
    if (readActiveProjectId() === id) store.removeItem(STORAGE_KEYS.activeProject);
    return { ok: true };
  } catch {
    return { ok: false, code: "unknown", error: "The project could not be deleted." };
  }
}

export function readActiveProjectId(): string | null {
  const store = storage();
  if (!store) return null;
  try {
    return store.getItem(STORAGE_KEYS.activeProject);
  } catch {
    return null;
  }
}

export function setActiveProjectId(id: string | null): void {
  const store = storage();
  if (!store) return;
  try {
    if (id) store.setItem(STORAGE_KEYS.activeProject, id);
    else store.removeItem(STORAGE_KEYS.activeProject);
  } catch {
    // Non-fatal.
  }
}
