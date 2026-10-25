import { create } from "zustand";

export type InspectorTab = "design" | "layers" | "presets";
export type MobilePanel = "assets" | "inspector" | null;

interface UiState {
  inspectorTab: InspectorTab;
  mobilePanel: MobilePanel;
  projectManagerOpen: boolean;
  shortcutsOpen: boolean;
  sourcesOpen: boolean;
  exportOpen: boolean;
  previewOpen: boolean;
  fitToken: number;
  setInspectorTab: (tab: InspectorTab) => void;
  setMobilePanel: (panel: MobilePanel) => void;
  setProjectManagerOpen: (open: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;
  setSourcesOpen: (open: boolean) => void;
  setExportOpen: (open: boolean) => void;
  setPreviewOpen: (open: boolean) => void;
  requestFit: () => void;
  closeMenus: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  inspectorTab: "design",
  mobilePanel: null,
  projectManagerOpen: false,
  shortcutsOpen: false,
  sourcesOpen: false,
  exportOpen: false,
  previewOpen: false,
  fitToken: 0,
  setInspectorTab: (inspectorTab) => set({ inspectorTab }),
  setMobilePanel: (mobilePanel) => set({ mobilePanel }),
  setProjectManagerOpen: (projectManagerOpen) => set({ projectManagerOpen }),
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
  setSourcesOpen: (sourcesOpen) => set({ sourcesOpen }),
  setExportOpen: (exportOpen) => set({ exportOpen }),
  setPreviewOpen: (previewOpen) => set({ previewOpen }),
  requestFit: () => set((state) => ({ fitToken: state.fitToken + 1 })),
  closeMenus: () =>
    set({ mobilePanel: null, projectManagerOpen: false, shortcutsOpen: false, sourcesOpen: false }),
}));

export function anyModalOpen(): boolean {
  const state = useUiStore.getState();
  return (
    state.projectManagerOpen ||
    state.shortcutsOpen ||
    state.sourcesOpen ||
    state.exportOpen ||
    state.previewOpen
  );
}
