import { useCallback, useEffect, useRef, useState } from "react";
import { APP_CONFIG } from "@/config";
import { releaseAllUploadUrls } from "@/features/assets/uploads";
import { loadBundledFonts } from "@/features/assets/fonts";
import { useEditorStore } from "@/features/editor/store";
import { SCENE_VERSION, createBlankScene, makeId, type ProjectFile } from "@/features/editor/types";
import { buildProjectFilename } from "@/features/export/download";
import {
  createPortableProject,
  createProject,
  duplicateProject as duplicateProjectFile,
  hydrateProjectUploads,
  importProjectJson,
  projectToJson,
} from "@/features/projects/serialize";
import {
  deleteProjectFromLibrary,
  getProject,
  readActiveProjectId,
  readProjectLibrary,
  setActiveProjectId,
  writeProject,
} from "@/features/projects/storage";
import { notify } from "@/components/ui/toast";
import { downloadBlob, sanitizeFilename } from "@/lib/utils";

export interface ProjectSession {
  ready: boolean;
  bootError: string | null;
  warnings: string[];
  libraryVersion: number;
  saveNow: () => Promise<boolean>;
  exportProjectJson: () => Promise<void>;
  importProjectFile: (file: File) => Promise<void>;
  newProject: (options?: { skipSave?: boolean }) => Promise<void>;
  openProject: (id: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  duplicateProject: (id: string) => Promise<void>;
  renameProject: (id: string, name: string) => Promise<void>;
  refresh: () => void;
}

function currentProject(): ProjectFile {
  const state = useEditorStore.getState();
  return {
    schemaVersion: SCENE_VERSION,
    appId: "isaac-thumbnail-studio",
    id: state.projectId,
    name: state.projectName.trim().slice(0, 80) || "Untitled thumbnail",
    createdAt: state.createdAt,
    updatedAt: new Date().toISOString(),
    scene: state.scene,
  };
}

export function useProjectSession(): ProjectSession {
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [libraryVersion, setLibraryVersion] = useState(0);
  const errorRef = useRef<string | null>(null);
  const readyRef = useRef(false);
  const savingRef = useRef(false);
  const saveRef = useRef<((manual: boolean, silent?: boolean) => Promise<boolean>) | null>(null);

  const refresh = useCallback(() => setLibraryVersion((value) => value + 1), []);

  const downloadCurrentProjectFile = useCallback(async () => {
    const state = useEditorStore.getState();
    const project = currentProject();
    try {
      const { project: portable, missingUploads } = await createPortableProject(project);
      const blob = new Blob([projectToJson(portable)], { type: "application/json" });
      downloadBlob(blob, buildProjectFilename(sanitizeFilename(project.name, "isaac-project")));
      notify.success(
        "Project file downloaded",
        missingUploads.length > 0
          ? `Portable JSON created. ${missingUploads.length} missing upload(s) could not be embedded.`
          : "Portable JSON includes project settings and uploaded images.",
      );
      if (state.dirty) void saveRef.current?.(false, true);
    } catch (error) {
      notify.error(
        "Could not export project file",
        error instanceof Error ? error.message : "Try again.",
      );
    }
  }, []);

  const save = useCallback(
    async (manual: boolean, silent = false): Promise<boolean> => {
      if (!readyRef.current) return false;
      if (savingRef.current) return false;
      savingRef.current = true;
      try {
        const project = currentProject();
        const result = writeProject(project);
        if (result.ok) {
          useEditorStore.getState().markSaved(result.updatedAt);
          errorRef.current = null;
          refresh();
          if (manual) {
            notify.success(
              "Saved in this browser",
              "This project lives in local browser storage. Export a project file to move it elsewhere.",
            );
          }
          return true;
        }
        const message = result.error ?? "The project could not be saved.";
        useEditorStore.getState().markSaveError(message);
        if (!silent && errorRef.current !== message) {
          errorRef.current = message;
          notify.error("Could not save project", message, {
            label: "Download project file",
            onClick: () => {
              void downloadCurrentProjectFile();
            },
          });
        }
        return false;
      } finally {
        savingRef.current = false;
      }
    },
    [downloadCurrentProjectFile, refresh],
  );

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      try {
        await loadBundledFonts();
        const library = readProjectLibrary();
        const activeId = readActiveProjectId();
        let project =
          (activeId ? library.projects.find((entry) => entry.id === activeId) : undefined) ??
          library.projects[0];
        let createdNew = false;

        if (!project) {
          project = createProject({
            name: "My first thumbnail",
            scene: createBlankScene(),
          });
          createdNew = true;
        }

        const hydrated = await hydrateProjectUploads(project);
        if (cancelled) return;
        useEditorStore.getState().replaceProject(hydrated.project);
        readyRef.current = true;
        setReady(true);
        setWarnings([...library.warnings, ...hydrated.warnings]);
        setActiveProjectId(hydrated.project.id);
        if (createdNew) {
          const saved = writeProject(hydrated.project);
          if (saved.ok) useEditorStore.getState().markSaved(saved.updatedAt);
          else {
            useEditorStore
              .getState()
              .markSaveError(saved.error ?? "The starter project could not be saved.");
            setBootError(saved.error ?? null);
          }
        }
        refresh();
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "The editor could not start.";
        setBootError(message);
        readyRef.current = true;
        setReady(true);
      }
    };
    void boot();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  // Debounced autosave follows scene and name changes.
  const scene = useEditorStore((state) => state.scene);
  const projectName = useEditorStore((state) => state.projectName);
  useEffect(() => {
    if (!ready) return;
    if (!useEditorStore.getState().dirty) return;
    const timer = window.setTimeout(() => {
      void saveRef.current?.(false, true);
    }, APP_CONFIG.autosaveDelayMs);
    return () => window.clearTimeout(timer);
  }, [scene, projectName, ready]);

  useEffect(() => {
    const onHide = () => {
      if (useEditorStore.getState().dirty) void saveRef.current?.(false, true);
      releaseAllUploadUrls();
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, []);

  const exportProjectJson = useCallback(async () => {
    await downloadCurrentProjectFile();
  }, [downloadCurrentProjectFile]);

  const ensureSavedBeforeSwitch = useCallback(async (): Promise<boolean> => {
    if (!useEditorStore.getState().dirty) return true;
    const saved = await save(true, true);
    if (!saved) {
      notify.error(
        "Switch cancelled",
        "The current project could not be saved. Export it as JSON or free browser storage, then try again.",
      );
    }
    return saved;
  }, [save]);

  const newProject = useCallback(
    async (options?: { skipSave?: boolean }) => {
      if (!options?.skipSave) {
        const canSwitch = await ensureSavedBeforeSwitch();
        if (!canSwitch) return;
      }
      const project = createProject({
        name: "Untitled thumbnail",
        scene: createBlankScene(),
      });
      const result = writeProject(project);
      if (!result.ok) {
        notify.error(
          result.code === "limit" ? "Project limit reached" : "Could not create the project",
          result.error ?? "Browser storage failed. Your current project was left open.",
        );
        return;
      }
      useEditorStore.getState().replaceProject(project);
      readyRef.current = true;
      setReady(true);
      setActiveProjectId(project.id);
      useEditorStore.getState().markSaved(result.updatedAt);
      notify.success("New project created", "Saved in this browser.");
      refresh();
    },
    [ensureSavedBeforeSwitch, refresh],
  );

  const openProject = useCallback(
    async (id: string) => {
      if (id === useEditorStore.getState().projectId) return;
      const canSwitch = await ensureSavedBeforeSwitch();
      if (!canSwitch) return;
      const project = getProject(id);
      if (!project) {
        notify.error("Project not found", "It may have been deleted from this browser.");
        refresh();
        return;
      }
      const hydrated = await hydrateProjectUploads(project);
      useEditorStore.getState().replaceProject(hydrated.project);
      setActiveProjectId(id);
      if (hydrated.warnings.length > 0) {
        notify.info("Project opened with warnings", hydrated.warnings.join(" "));
      }
      refresh();
    },
    [ensureSavedBeforeSwitch, refresh],
  );

  const deleteProject = useCallback(
    async (id: string) => {
      if (id === useEditorStore.getState().projectId) {
        const canDelete = await ensureSavedBeforeSwitch();
        if (!canDelete) return;
      }
      const result = deleteProjectFromLibrary(id);
      if (!result.ok) {
        notify.error("Could not delete project", result.error ?? "Try again.");
        return;
      }
      refresh();
      if (useEditorStore.getState().projectId === id) {
        const remaining = readProjectLibrary().projects;
        if (remaining[0]) {
          const hydrated = await hydrateProjectUploads(remaining[0]);
          useEditorStore.getState().replaceProject(hydrated.project);
          setActiveProjectId(remaining[0].id);
        } else {
          await newProject({ skipSave: true });
        }
      }
      notify.success("Project deleted");
    },
    [ensureSavedBeforeSwitch, newProject, refresh],
  );

  const duplicateProject = useCallback(
    async (id: string) => {
      const canSwitch = await ensureSavedBeforeSwitch();
      if (!canSwitch) return;
      const source = getProject(id);
      if (!source) {
        notify.error("Project not found");
        return;
      }
      const duplicate = duplicateProjectFile(source);
      const result = writeProject(duplicate);
      if (!result.ok) {
        notify.error("Could not duplicate project", result.error ?? "Browser storage failed.");
        return;
      }
      const hydrated = await hydrateProjectUploads(duplicate);
      useEditorStore.getState().replaceProject(hydrated.project);
      setActiveProjectId(duplicate.id);
      refresh();
      notify.success("Project duplicated", "The copy is now open.");
    },
    [ensureSavedBeforeSwitch, refresh],
  );

  const renameProject = useCallback(
    async (id: string, name: string) => {
      if (id === useEditorStore.getState().projectId) {
        useEditorStore.getState().setProjectName(name);
        const saved = await save(true, true);
        if (!saved) {
          notify.error("Name changed, but not saved", "Browser storage is unavailable or full.");
        }
        refresh();
        return;
      }
      const project = getProject(id);
      if (!project) {
        notify.error("Project not found");
        return;
      }
      const result = writeProject({ ...project, name, updatedAt: new Date().toISOString() });
      if (!result.ok) {
        notify.error("Could not rename project", result.error ?? "Browser storage failed.");
        return;
      }
      refresh();
    },
    [refresh, save],
  );

  const importProjectFile = useCallback(
    async (file: File) => {
      if (useEditorStore.getState().dirty) {
        const canImport = await ensureSavedBeforeSwitch();
        if (!canImport) return;
      }
      if (file.size > APP_CONFIG.maxImportBytes) {
        notify.error(
          "That project file is too large",
          `The import limit is ${Math.round(APP_CONFIG.maxImportBytes / 1024 / 1024)} MB.`,
        );
        return;
      }
      let text: string;
      try {
        text = await file.text();
      } catch {
        notify.error("Could not read that file");
        return;
      }
      const result = await importProjectJson(text);
      if (!result.ok) {
        notify.error("Invalid project file", result.error);
        return;
      }
      const library = readProjectLibrary();
      const conflicting = library.projects.some((project) => project.id === result.project.id);
      const project: ProjectFile = conflicting
        ? {
            ...result.project,
            id: makeId("project"),
            name: `${result.project.name.slice(0, 70)} (imported)`.slice(0, 80),
          }
        : result.project;
      const saved = writeProject(project);
      useEditorStore.getState().replaceProject(project);
      readyRef.current = true;
      setReady(true);
      setActiveProjectId(project.id);
      refresh();
      notify.success(
        "Project imported",
        [
          ...result.warnings,
          saved.ok ? "Saved in this browser." : (saved.error ?? "Not saved to browser storage."),
        ]
          .filter(Boolean)
          .join(" "),
      );
    },
    [ensureSavedBeforeSwitch, refresh],
  );

  return {
    ready,
    bootError,
    warnings,
    libraryVersion,
    saveNow: () => save(true),
    exportProjectJson,
    importProjectFile,
    newProject,
    openProject,
    deleteProject,
    duplicateProject,
    renameProject,
    refresh,
  };
}
