import type Konva from "konva";

export interface ExportLayers {
  background: Konva.Layer;
  content: Konva.Layer;
}

let layers: ExportLayers | null = null;

export function setExportLayers(next: ExportLayers | null): void {
  layers = next;
}

export function getExportLayers(): ExportLayers | null {
  return layers;
}
