import { useEffect, useRef } from "react";
import { useEditorStore } from "@/features/editor/store";
import { useUiStore, anyModalOpen } from "@/features/editor/uiStore";
import { isEditableTarget } from "@/lib/utils";

interface ShortcutOptions {
  onSave: () => void;
}

export function useEditorShortcuts({ onSave }: ShortcutOptions): void {
  const saveRef = useRef(onSave);

  useEffect(() => {
    saveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (anyModalOpen()) return;
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key;
      const lower = key.toLowerCase();
      const editor = useEditorStore.getState();
      const ui = useUiStore.getState();

      // Saving is safe while typing and should still work from a text field.
      if (mod && lower === "s") {
        event.preventDefault();
        saveRef.current();
        return;
      }
      if (isEditableTarget(event.target)) return;

      if (mod && lower === "z" && !event.shiftKey) {
        event.preventDefault();
        editor.undo();
        return;
      }
      if ((mod && lower === "z" && event.shiftKey) || (mod && lower === "y")) {
        event.preventDefault();
        editor.redo();
        return;
      }
      if (mod && lower === "d") {
        event.preventDefault();
        if (editor.selectedIds.length > 0) editor.duplicateSelected();
        return;
      }
      if (mod && lower === "e") {
        event.preventDefault();
        ui.setExportOpen(true);
        return;
      }
      if (!mod && !event.altKey && lower === "p") {
        event.preventDefault();
        ui.setPreviewOpen(true);
        return;
      }
      if (mod && lower === "o") {
        event.preventDefault();
        ui.setProjectManagerOpen(true);
        return;
      }
      if (mod && (key === "=" || key === "+")) {
        event.preventDefault();
        useEditorStore.getState().setZoom(editor.zoom + 0.1);
        return;
      }
      if (mod && key === "-") {
        event.preventDefault();
        useEditorStore.getState().setZoom(editor.zoom - 0.1);
        return;
      }
      if (key === "Delete" || key === "Backspace") {
        if (editor.selectedIds.length > 0) {
          event.preventDefault();
          editor.deleteSelected();
        }
        return;
      }
      if (key === "Escape") {
        editor.clearSelection();
        return;
      }
      if (key === "ArrowUp" || key === "ArrowDown" || key === "ArrowLeft" || key === "ArrowRight") {
        if (editor.selectedIds.length === 0) return;
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        if (key === "ArrowUp") editor.nudgeSelected(0, -step);
        if (key === "ArrowDown") editor.nudgeSelected(0, step);
        if (key === "ArrowLeft") editor.nudgeSelected(-step, 0);
        if (key === "ArrowRight") editor.nudgeSelected(step, 0);
        return;
      }
      if (!mod && !event.altKey && lower === "t") {
        event.preventDefault();
        editor.addText();
        ui.setInspectorTab("design");
        return;
      }
      if (!mod && !event.altKey && (key === "+" || key === "=")) {
        event.preventDefault();
        editor.setZoom(editor.zoom + 0.1);
        return;
      }
      if (!mod && key === "-") {
        event.preventDefault();
        editor.setZoom(editor.zoom - 0.1);
        return;
      }
      if (!mod && key === "0") {
        event.preventDefault();
        ui.requestFit();
        return;
      }
      if (key === "?") {
        event.preventDefault();
        ui.setShortcutsOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}

export const SHORTCUTS = [
  { keys: "Ctrl / ⌘ + Z", action: "Undo" },
  { keys: "Ctrl / ⌘ + Shift + Z", action: "Redo" },
  { keys: "Ctrl / ⌘ + D", action: "Duplicate selected layers" },
  { keys: "Delete / Backspace", action: "Delete selected layers" },
  { keys: "Arrow keys", action: "Nudge selection 1px (Shift = 10px)" },
  { keys: "T", action: "Add a text layer" },
  { keys: "Ctrl / ⌘ + S", action: "Save the project locally" },
  { keys: "Ctrl / ⌘ + E", action: "Open the export dialog" },
  { keys: "P", action: "Preview the final composition" },
  { keys: "Ctrl / ⌘ + O", action: "Open the project manager" },
  { keys: "+ / −", action: "Zoom in or out" },
  { keys: "0", action: "Fit the canvas to the workspace" },
  { keys: "Esc", action: "Clear selection" },
  { keys: "?", action: "Show keyboard shortcuts" },
] as const;
