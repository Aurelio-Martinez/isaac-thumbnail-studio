import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AssetCard } from "@/components/library/AssetCard";
import { MobileBar } from "@/components/layout/MobileBar";
import { LayersPanel } from "@/components/editor/LayersPanel";
import { useEditorStore, resetEditorStore } from "@/features/editor/store";
import { useUiStore } from "@/features/editor/uiStore";
import { useEditorShortcuts } from "@/features/editor/useEditorShortcuts";
import { makeAsset, makeAssetRef } from "./fixtures";

function wrap(children: ReactNode) {
  return <TooltipProvider>{children}</TooltipProvider>;
}

beforeEach(() => {
  resetEditorStore();
  useUiStore.setState({
    inspectorTab: "design",
    mobilePanel: null,
    projectManagerOpen: false,
    shortcutsOpen: false,
    sourcesOpen: false,
    exportOpen: false,
    previewOpen: false,
    fitToken: 0,
  });
});

describe("asset card accessibility", () => {
  it("adds artwork with the keyboard and exposes a named favorite toggle", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    const onFavorite = vi.fn();
    render(
      <AssetCard
        asset={makeAsset({ name: "Pip" })}
        onAdd={onAdd}
        onToggleFavorite={onFavorite}
        isFavorite={false}
      />,
    );
    const addButton = screen.getByRole("button", { name: /Add Pip/ });
    addButton.focus();
    expect(addButton).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onAdd).toHaveBeenCalledTimes(1);

    const favorite = screen.getByRole("button", { name: "Favorite Pip" });
    expect(favorite).toHaveAttribute("aria-pressed", "false");
    await user.click(favorite);
    expect(onFavorite).toHaveBeenCalledWith(expect.objectContaining({ name: "Pip" }));
  });

  it("shows a retry action when a thumbnail fails", () => {
    const { container } = render(
      <AssetCard
        asset={makeAsset({ name: "Glint" })}
        onAdd={vi.fn()}
        onToggleFavorite={vi.fn()}
        isFavorite={false}
      />,
    );
    const image = container.querySelector("img");
    expect(image).not.toBeNull();
    fireEvent.error(image!);
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry loading Glint" })).toBeInTheDocument();
  });
});

describe("responsive navigation", () => {
  it("opens artwork and inspector panels from the mobile bar", async () => {
    const user = userEvent.setup();
    render(<MobileBar />);
    const nav = screen.getByRole("navigation", { name: "Editor panels" });
    expect(nav).toBeInTheDocument();
    await user.click(within(nav).getByRole("button", { name: "Artwork" }));
    expect(useUiStore.getState().mobilePanel).toBe("assets");
    await user.click(within(nav).getByRole("button", { name: "Layers" }));
    expect(useUiStore.getState().mobilePanel).toBe("inspector");
    expect(useUiStore.getState().inspectorTab).toBe("layers");
    await user.click(within(nav).getByRole("button", { name: "Presets" }));
    expect(useUiStore.getState().inspectorTab).toBe("presets");
    await user.click(within(nav).getByRole("button", { name: "Fit" }));
    expect(useUiStore.getState().fitToken).toBe(1);
  });
});

describe("layers panel", () => {
  it("selects, hides, locks, and adds layers through accessible controls", async () => {
    const user = userEvent.setup();
    useEditorStore
      .getState()
      .addAsset(makeAssetRef({ id: "pip", name: "Pip", category: "characters" }));
    render(wrap(<LayersPanel />));

    const select = screen.getByRole("button", { name: /Select Pip layer/ });
    await user.click(select);
    expect(useEditorStore.getState().selectedIds).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Hide Pip" }));
    expect(useEditorStore.getState().scene.layers[0]?.visible).toBe(false);
    expect(screen.getByRole("button", { name: "Show Pip" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Lock Pip" }));
    expect(useEditorStore.getState().scene.layers[0]?.locked).toBe(true);
    expect(screen.getByRole("button", { name: "Unlock Pip" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Text" }));
    expect(useEditorStore.getState().scene.layers).toHaveLength(2);
  });

  it("supports shift-click multi-selection", async () => {
    const user = userEvent.setup();
    const store = useEditorStore.getState();
    store.addAsset(makeAssetRef({ id: "a", name: "A", category: "characters" }));
    store.addAsset(makeAssetRef({ id: "b", name: "B", category: "collectibles" }));
    render(wrap(<LayersPanel />));
    const a = screen.getByRole("button", { name: /Select A layer/ });
    const b = screen.getByRole("button", { name: /Select B layer/ });
    await user.click(a);
    await user.keyboard("{Shift>}");
    await user.click(b);
    await user.keyboard("{/Shift}");
    expect(useEditorStore.getState().selectedIds).toHaveLength(2);
  });
});

describe("keyboard shortcuts", () => {
  it("nudges selected layers and saves, while ignoring inputs", () => {
    const onSave = vi.fn();
    renderHook(() => useEditorShortcuts({ onSave }));
    useEditorStore.getState().addAsset(makeAssetRef({ id: "a", name: "A" }));
    const startX = useEditorStore.getState().scene.layers[0]!.x;
    const startY = useEditorStore.getState().scene.layers[0]!.y;

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(useEditorStore.getState().scene.layers[0]!.x).toBe(startX + 1);
    fireEvent.keyDown(window, { key: "ArrowDown", shiftKey: true });
    expect(useEditorStore.getState().scene.layers[0]!.y).toBe(startY + 10);

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    fireEvent.keyDown(input, { key: "ArrowRight" });
    expect(useEditorStore.getState().scene.layers[0]!.x).toBe(startX + 1);
    input.remove();

    fireEvent.keyDown(window, { key: "s", ctrlKey: true });
    expect(onSave).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(useEditorStore.getState().scene.layers[0]!.x).toBe(startX);
  });

  it("does not delete while a modal is open", () => {
    renderHook(() => useEditorShortcuts({ onSave: vi.fn() }));
    useEditorStore.getState().addAsset(makeAssetRef({ id: "a", name: "A" }));
    useUiStore.setState({ exportOpen: true });
    fireEvent.keyDown(window, { key: "Delete" });
    expect(useEditorStore.getState().scene.layers).toHaveLength(1);
    useUiStore.setState({ exportOpen: false });
    fireEvent.keyDown(window, { key: "Delete" });
    expect(useEditorStore.getState().scene.layers).toHaveLength(0);
  });
});
