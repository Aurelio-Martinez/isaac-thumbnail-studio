import { Buffer } from "node:buffer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEYS } from "@/config";
import {
  deleteProjectFromLibrary,
  getProject,
  readActiveProjectId,
  readProjectLibrary,
  setActiveProjectId,
  writeProject,
} from "@/features/projects/storage";
import {
  createPortableProject,
  createProject,
  prepareProjectForStorage,
  projectToJson,
  importProjectJson,
  hydrateProjectUploads,
  collectUploadRefs,
} from "@/features/projects/serialize";
import {
  SCENE_VERSION,
  createImageLayer as makeImageLayer,
  createTextLayer,
  type ProjectFile,
  type Scene,
} from "@/features/editor/types";
import { parseProjectFile, parseProjectJson, projectFileSchema } from "@/features/editor/schema";
import { classifyImageIssues, collectImageRequirements } from "@/features/export/preflight";
import { readPngDimensions } from "@/features/export/png";
import { buildThumbnailFilename } from "@/features/export/download";
import { dataUrlToBlob } from "@/lib/utils";
import { PNG_1X1_BASE64, makeAssetRef, makeText } from "./fixtures";

function makeScene(layers: Scene["layers"] = []): Scene {
  return {
    version: SCENE_VERSION,
    background: {
      mode: "color",
      color: "#17141c",
      asset: null,
      opacity: 1,
      fit: "cover",
      dim: 0,
      vignette: true,
    },
    layers,
  };
}

function makeProject(overrides: Partial<ProjectFile> = {}): ProjectFile {
  return {
    ...createProject({ name: "Test Project", scene: makeScene([makeText({ text: "HELLO" })]) }),
    ...overrides,
  };
}

beforeEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("project serialization and validation", () => {
  it("round-trips a valid project", () => {
    const project = makeProject();
    const json = projectToJson(project);
    const parsed = parseProjectJson(json);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.project.name).toBe("Test Project");
    expect(parsed.project.scene.layers).toHaveLength(1);
    expect(projectFileSchema.safeParse(parsed.project).success).toBe(true);
  });

  it("rejects malformed JSON and unsupported schema versions", () => {
    expect(parseProjectJson("{not json").ok).toBe(false);
    const project = makeProject();
    expect(parseProjectFile({ ...project, schemaVersion: 99 }).ok).toBe(false);
    expect(parseProjectFile({ ...project, appId: "another-app" }).ok).toBe(false);
    expect(parseProjectJson("[]").ok).toBe(false);
  });

  it("rejects unsafe image URLs and empty art references", () => {
    const evil = makeImageLayer(makeAssetRef({ imageUrl: "https://evil.example/a.png" }), {
      id: "layer-evil",
    });
    expect(parseProjectFile(makeProject({ scene: makeScene([evil]) })).ok).toBe(false);

    const badSource = makeImageLayer(makeAssetRef({ sourceUrl: "javascript:alert(1)" }), {
      id: "layer-source",
    });
    expect(parseProjectFile(makeProject({ scene: makeScene([badSource]) })).ok).toBe(false);

    const badThumb = makeImageLayer(
      makeAssetRef({ thumbnailUrl: "https://evil.example/thumb.png" }),
      { id: "layer-thumb" },
    );
    expect(parseProjectFile(makeProject({ scene: makeScene([badThumb]) })).ok).toBe(false);

    const empty = makeImageLayer(makeAssetRef({ imageUrl: "" }), { id: "layer-empty" });
    expect(parseProjectFile(makeProject({ scene: makeScene([empty]) })).ok).toBe(false);

    const upload = makeImageLayer(
      makeAssetRef({ imageUrl: "", uploadId: "up-123", thumbnailUrl: "" }),
      { id: "layer-upload" },
    );
    expect(parseProjectFile(makeProject({ scene: makeScene([upload]) })).ok).toBe(true);
  });

  it("rejects duplicate ids and excess text", () => {
    const layer = createTextLayer({ id: "same-id" });
    const duplicate = { ...layer, name: "Other" };
    const project = makeProject({ scene: makeScene([layer, duplicate]) });
    const result = parseProjectFile(project);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("duplicate layer IDs");

    const longText = createTextLayer({ id: "long-text" });
    longText.text = "x".repeat(501);
    expect(parseProjectFile(makeProject({ scene: makeScene([longText]) })).ok).toBe(false);
  });

  it("strips upload object URLs for storage while keeping the upload id", () => {
    const upload = makeImageLayer(
      makeAssetRef({
        imageUrl: "blob:https://localhost/abc",
        thumbnailUrl: "blob:https://localhost/abc",
        uploadId: "up-1",
      }),
      { id: "upload-layer" },
    );
    const project = makeProject({ scene: makeScene([upload]) });
    const stored = prepareProjectForStorage(project);
    expect(stored.scene.layers[0]).toMatchObject({
      type: "image",
      asset: { imageUrl: "", thumbnailUrl: "", uploadId: "up-1" },
    });
    expect(stored.embeddedAssets).toBeUndefined();
    expect(collectUploadRefs(stored.scene)).toHaveLength(1);
  });

  it("builds portable JSON with embedded uploads when possible", async () => {
    const upload = makeImageLayer(
      makeAssetRef({
        imageUrl: "",
        thumbnailUrl: "",
        uploadId: "missing-upload",
        name: "Lost image",
      }),
      { id: "upload-layer" },
    );
    const project = makeProject({ scene: makeScene([upload]) });
    const portable = await createPortableProject(project);
    expect(portable.project.scene.layers).toHaveLength(1);
    expect(portable.missingUploads).toContain("Lost image");
    expect(parseProjectFile(portable.project).ok).toBe(true);
  });

  it("migrates projects that reference removed bundled artwork", async () => {
    const legacy = makeImageLayer(
      makeAssetRef({
        id: "local-character-pip",
        name: "Pip",
        providerId: "bundled",
        imageUrl: "/media/original/characters/character-pip.svg",
        thumbnailUrl: "/media/original/characters/character-pip.svg",
        sourceUrl: "/media/original/characters/character-pip.svg",
      }),
      { id: "legacy-pip" },
    );
    const text = createTextLayer({ id: "keep-text", text: "KEEP ME" });
    const scene = makeScene([legacy, text]);
    scene.background = {
      mode: "image",
      color: "#17141c",
      asset: makeAssetRef({
        providerId: "bundled",
        imageUrl: "/media/backgrounds/cellar-dusk.svg",
        thumbnailUrl: "/media/backgrounds/cellar-dusk.svg",
        sourceUrl: "/media/backgrounds/cellar-dusk.svg",
      }),
      opacity: 1,
      fit: "cover",
      dim: 0,
      vignette: false,
    };
    const hydrated = await hydrateProjectUploads(makeProject({ scene }));
    expect(hydrated.project.scene.layers.map((layer) => layer.name)).toEqual(["Headline"]);
    expect(hydrated.project.scene.layers[0]?.type).toBe("text");
    expect(hydrated.project.scene.background.mode).toBe("transparent");
    expect(hydrated.warnings.join(" ")).toContain("removed bundled artwork");
  });

  it("returns warnings when hydrating missing uploads", async () => {
    const upload = makeImageLayer(
      makeAssetRef({ imageUrl: "", thumbnailUrl: "", uploadId: "does-not-exist", name: "Ghost" }),
      { id: "ghost-layer" },
    );
    const project = makeProject({ scene: makeScene([upload]) });
    const hydrated = await hydrateProjectUploads(project);
    expect(hydrated.warnings.join(" ")).toContain("Ghost");
    expect(hydrated.project.scene.layers[0]?.type).toBe("image");
  });

  it("rejects non-image embedded asset payloads during import", async () => {
    const project = makeProject();
    const result = await importProjectJson(
      JSON.stringify({
        ...project,
        embeddedAssets: { "up-1": "data:text/html;base64,PHNjcmlwdD4=" },
      }),
    );
    expect(result.ok).toBe(false);
  });
});

describe("local project storage", () => {
  it("saves, updates, restores, and deletes projects", () => {
    const first = makeProject({ name: "First" });
    const result = writeProject(first);
    expect(result.ok).toBe(true);
    expect(result.updatedAt).toBeTruthy();
    let library = readProjectLibrary();
    expect(library.projects).toHaveLength(1);
    expect(library.projects[0]?.name).toBe("First");

    writeProject({ ...first, name: "Renamed" });
    library = readProjectLibrary();
    expect(library.projects).toHaveLength(1);
    expect(getProject(first.id)?.name).toBe("Renamed");

    setActiveProjectId(first.id);
    expect(readActiveProjectId()).toBe(first.id);

    expect(deleteProjectFromLibrary(first.id).ok).toBe(true);
    expect(readProjectLibrary().projects).toHaveLength(0);
    expect(readActiveProjectId()).toBeNull();
  });

  it("reports quota failures without throwing", () => {
    const first = makeProject();
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key === STORAGE_KEYS.projects) {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      }
      return original.call(this, key, value);
    });
    const result = writeProject(first);
    expect(result.ok).toBe(false);
    expect(result.code).toBe("quota");
    expect(result.error).toContain("storage is full");
  });

  it("skips corrupted saved entries and reports warnings", () => {
    window.localStorage.setItem(STORAGE_KEYS.projects, JSON.stringify([{ nope: true }]));
    const library = readProjectLibrary();
    expect(library.projects).toEqual([]);
    expect(library.warnings.join(" ")).toContain("Skipped");
  });

  it("does not exceed the local project limit", () => {
    for (let i = 0; i < 25; i += 1) {
      expect(writeProject(makeProject({ name: `Project ${i}` })).ok).toBe(true);
    }
    const overflow = writeProject(makeProject({ name: "Too many" }));
    expect(overflow.ok).toBe(false);
    expect(overflow.code).toBe("limit");
  });
});

describe("export preflight and PNG helpers", () => {
  it("builds the expected filename", () => {
    expect(buildThumbnailFilename(new Date(2026, 9, 25))).toBe("isaac-thumbnail-2026-10-25.png");
  });

  it("reads dimensions and MIME from a real PNG", () => {
    const bytes = Uint8Array.from(Buffer.from(PNG_1X1_BASE64, "base64"));
    expect(readPngDimensions(bytes)).toEqual({ width: 1, height: 1 });
    const blob = dataUrlToBlob(`data:image/png;base64,${PNG_1X1_BASE64}`);
    expect(blob.type).toBe("image/png");
    expect(blob.size).toBeGreaterThan(0);
    expect(readPngDimensions(new Uint8Array([1, 2, 3]))).toBeNull();
    expect(readPngDimensions(new Uint8Array(bytes.length))).toBeNull();
  });

  it("collects only visible artwork and the background", () => {
    const visible = makeImageLayer(makeAssetRef({ name: "Visible" }), { id: "visible" });
    const hidden = makeImageLayer(makeAssetRef({ name: "Hidden" }), {
      id: "hidden",
      visible: false,
    });
    const scene = makeScene([visible, hidden]);
    scene.background = {
      mode: "image",
      color: "#000000",
      asset: makeAssetRef({ name: "Backdrop" }),
      opacity: 1,
      fit: "cover",
      dim: 0,
      vignette: false,
    };
    const requirements = collectImageRequirements(scene);
    expect(requirements.map((requirement) => requirement.name)).toEqual([
      "Backdrop (background)",
      "Visible",
    ]);
  });

  it("classifies missing uploads, failures, taint risks, and loaded images", () => {
    const missingUpload = makeImageLayer(
      makeAssetRef({ name: "Missing", imageUrl: "", thumbnailUrl: "", uploadId: "u1" }),
      { id: "missing" },
    );
    const failed = makeImageLayer(
      makeAssetRef({
        name: "Failed",
        imageUrl: "https://bindingofisaacrebirth.wiki.gg/images/F.png",
      }),
      { id: "failed" },
    );
    const unsafe = makeImageLayer(
      makeAssetRef({
        name: "Unsafe",
        imageUrl: "https://bindingofisaacrebirth.wiki.gg/images/U.png",
      }),
      { id: "unsafe" },
    );
    const loaded = makeImageLayer(
      makeAssetRef({
        name: "Loaded",
        imageUrl: "https://bindingofisaacrebirth.wiki.gg/images/L.png",
      }),
      { id: "loaded" },
    );
    const scene = makeScene([missingUpload, failed, unsafe, loaded]);
    const requirements = collectImageRequirements(scene);
    const issues = classifyImageIssues(requirements, (src) => {
      if (src.endsWith("F.png")) {
        return { status: "error", exportSafe: false, error: "404" };
      }
      if (src.endsWith("U.png")) {
        return { status: "loaded", exportSafe: false, error: "No CORS" };
      }
      if (src.endsWith("L.png")) {
        return { status: "loaded", exportSafe: true, error: null };
      }
      return null;
    });
    expect(issues.map((issue) => [issue.name, issue.reason])).toEqual([
      ["Missing", "missing_upload"],
      ["Failed", "failed"],
      ["Unsafe", "unsafe"],
    ]);
  });
});
