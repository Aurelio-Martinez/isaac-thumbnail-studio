import { EXPORT_FILENAME_PREFIX } from "@/config";
import { sanitizeFilename, todayStamp } from "@/lib/utils";

export function buildThumbnailFilename(date = new Date()): string {
  return `${EXPORT_FILENAME_PREFIX}-${todayStamp(date)}.png`;
}

export function buildProjectFilename(projectName: string, date = new Date()): string {
  const safe = sanitizeFilename(projectName, "isaac-project");
  return `${safe}-${todayStamp(date)}.isaac-thumbnail.json`;
}

export function buildPreviewFilename(projectName: string): string {
  return `${sanitizeFilename(projectName, "preview")}-preview.png`;
}
