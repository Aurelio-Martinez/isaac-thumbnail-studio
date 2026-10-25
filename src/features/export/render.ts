import Konva from "konva";
import { APP_CONFIG } from "@/config";
import { ensureSceneFonts } from "@/features/assets/fonts";
import { getExportLayers } from "@/features/export/stageRegistry";
import { prepareSceneImages, type ImageIssue } from "@/features/export/preflight";
import type { Scene } from "@/features/editor/types";
import { readPngDimensions } from "@/features/export/png";
import { dataUrlToBlob } from "@/lib/utils";

export type ExportErrorCode =
  "not_ready" | "image_issues" | "tainted" | "render_failed" | "dimension_mismatch";

export class ExportError extends Error {
  readonly code: ExportErrorCode;
  readonly issues: ImageIssue[];

  constructor(message: string, code: ExportErrorCode, issues: ImageIssue[] = []) {
    super(message);
    this.name = "ExportError";
    this.code = code;
    this.issues = issues;
  }
}

export interface RenderOptions {
  onProgress?: (loaded: number, total: number) => void;
}

export interface RenderedThumbnail {
  blob: Blob;
  width: number;
  height: number;
  dataUrl: string;
}

function waitForCanvasPaint(): Promise<void> {
  if (typeof requestAnimationFrame !== "function") {
    return new Promise((resolve) => setTimeout(resolve, 32));
  }
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const timeout = setTimeout(finish, 250);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        clearTimeout(timeout);
        finish();
      }),
    );
  });
}

export async function renderThumbnail(
  scene: Scene,
  options: RenderOptions = {},
): Promise<RenderedThumbnail> {
  const issues = await prepareSceneImages(scene, options.onProgress);
  if (issues.length > 0) {
    throw new ExportError(
      "Some images are missing or unavailable. Fix them before exporting so the thumbnail is never incomplete.",
      "image_issues",
      issues,
    );
  }

  await ensureSceneFonts(scene);
  // Preflight may finish loading a late image; let React commit the Konva node
  // props (and the synchronous outline canvases) before cloning the layers.
  await waitForCanvasPaint();
  const exportLayers = getExportLayers();
  if (!exportLayers) {
    throw new ExportError("The canvas is not ready yet. Wait a moment and try again.", "not_ready");
  }

  let stage: Konva.Stage | null = null;
  try {
    const container = document.createElement("div");
    stage = new Konva.Stage({
      container,
      width: APP_CONFIG.canvasWidth,
      height: APP_CONFIG.canvasHeight,
      listening: false,
    });

    const backgroundClone = exportLayers.background.clone();
    const contentClone = exportLayers.content.clone();
    // Invisible hit rectangles exist only for comfortable selection; they must
    // never tint a pixel in the exported PNG.
    contentClone.find(".hit-area").forEach((node) => node.destroy());
    backgroundClone.listening(false);
    contentClone.listening(false);
    backgroundClone.imageSmoothingEnabled(true);
    contentClone.imageSmoothingEnabled(false);

    stage.add(backgroundClone);
    stage.add(contentClone);

    let dataUrl: string;
    try {
      // Do not use stage.toDataURL(): it creates a single smoothing context for
      // every layer. Content must use nearest-neighbor (matching the editor),
      // while photographic wiki backgrounds should stay smoothly downscaled.
      const size = {
        x: 0,
        y: 0,
        width: APP_CONFIG.canvasWidth,
        height: APP_CONFIG.canvasHeight,
        pixelRatio: 1,
      };
      const backgroundCanvas = backgroundClone.toCanvas({
        ...size,
        imageSmoothingEnabled: true,
      });
      const contentCanvas = contentClone.toCanvas({
        ...size,
        imageSmoothingEnabled: false,
      });

      const output = document.createElement("canvas");
      output.width = APP_CONFIG.canvasWidth;
      output.height = APP_CONFIG.canvasHeight;
      const context = output.getContext("2d");
      if (!context) {
        throw new ExportError("The browser could not allocate the export canvas.", "render_failed");
      }
      context.drawImage(backgroundCanvas, 0, 0);
      context.drawImage(contentCanvas, 0, 0);
      dataUrl = output.toDataURL("image/png");
    } catch (error) {
      if ((error as Error).name === "SecurityError") {
        throw new ExportError(
          "The browser blocked this export because one or more images are not CORS-safe. Retry the images or replace them with uploads.",
          "tainted",
        );
      }
      throw error;
    }

    const blob = dataUrlToBlob(dataUrl);
    if (blob.type !== "image/png") {
      throw new ExportError("The browser did not produce a PNG image.", "render_failed");
    }
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const dimensions = readPngDimensions(bytes);
    if (
      !dimensions ||
      dimensions.width !== APP_CONFIG.canvasWidth ||
      dimensions.height !== APP_CONFIG.canvasHeight
    ) {
      throw new ExportError(
        `Export produced ${dimensions ? `${dimensions.width}×${dimensions.height}` : "an unreadable image"} instead of ${APP_CONFIG.canvasWidth}×${APP_CONFIG.canvasHeight}.`,
        "dimension_mismatch",
      );
    }
    return {
      blob,
      width: dimensions.width,
      height: dimensions.height,
      dataUrl,
    };
  } catch (error) {
    if (error instanceof ExportError) throw error;
    throw new ExportError(
      "The PNG renderer failed. Try again, or reload if the problem continues.",
      "render_failed",
    );
  } finally {
    stage?.destroy();
  }
}
