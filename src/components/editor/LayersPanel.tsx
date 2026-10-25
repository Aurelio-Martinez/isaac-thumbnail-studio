import { useState } from "react";
import {
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  Layers,
  Lock,
  MoreHorizontal,
  Plus,
  Trash2,
  Type,
  Unlock,
  ArrowUp,
  ArrowDown,
  ChevronsUp,
  ChevronsDown,
} from "lucide-react";
import { useEditorStore } from "@/features/editor/store";
import { displayThumbnail } from "@/features/assets/resolve";
import type { Layer } from "@/features/editor/types";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/tooltip";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { notify } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

function LayerThumb({ layer }: { layer: Layer }) {
  if (layer.type === "text") {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded border border-line bg-ink-900 text-muted">
        <Type className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    );
  }
  return (
    <span className="checkerboard flex h-8 w-8 items-center justify-center overflow-hidden rounded border border-line">
      <img
        src={displayThumbnail(layer.asset.thumbnailUrl || layer.asset.imageUrl)}
        alt=""
        className="h-full w-full object-contain [image-rendering:pixelated]"
      />
    </span>
  );
}

function LayerRow({
  layer,
  displayIndex,
  dragging,
  setDragging,
  onDropOn,
}: {
  layer: Layer;
  displayIndex: number;
  dragging: string | null;
  setDragging: (id: string | null) => void;
  onDropOn: (id: string) => void;
}) {
  const selectedIds = useEditorStore((state) => state.selectedIds);
  const select = useEditorStore((state) => state.select);
  const toggleVisibility = useEditorStore((state) => state.toggleVisibility);
  const toggleLock = useEditorStore((state) => state.toggleLock);
  const duplicateSelected = useEditorStore((state) => state.duplicateSelected);
  const deleteLayer = useEditorStore((state) => state.deleteLayer);
  const reorderLayer = useEditorStore((state) => state.reorderLayer);
  const bringLayerToFront = useEditorStore((state) => state.bringLayerToFront);
  const sendLayerToBack = useEditorStore((state) => state.sendLayerToBack);
  const selected = selectedIds.includes(layer.id);

  return (
    <li
      data-selected={selected}
      className={cn(
        "layer-row group flex items-center gap-1 rounded border border-transparent px-1 py-1 transition-colors hover:bg-ink-800",
        selected && "border-gold/40",
        !layer.visible && "opacity-55",
      )}
      draggable
      onDragStart={(event) => {
        setDragging(layer.id);
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/x-its-layer", layer.id);
      }}
      onDragEnd={() => setDragging(null)}
      onDragOver={(event) => {
        if (dragging && dragging !== layer.id) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDropOn(layer.id);
      }}
    >
      <span
        className="cursor-grab px-0.5 text-muted-dim opacity-0 group-hover:opacity-100"
        title="Drag to reorder"
        aria-hidden="true"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </span>
      <Hint label={layer.visible ? "Hide layer" : "Show layer"}>
        <button
          type="button"
          aria-label={`${layer.visible ? "Hide" : "Show"} ${layer.name}`}
          aria-pressed={!layer.visible}
          onClick={() => toggleVisibility(layer.id)}
          className="rounded p-1 text-muted transition-colors hover:bg-ink-700 hover:text-cream focus-visible:outline-2 focus-visible:outline-gold"
        >
          {layer.visible ? (
            <Eye className="h-3 w-3" aria-hidden="true" />
          ) : (
            <EyeOff className="h-3 w-3" aria-hidden="true" />
          )}
        </button>
      </Hint>
      <button
        type="button"
        onClick={(event) => select(layer.id, event.shiftKey)}
        aria-label={`Select ${layer.name} layer${selected ? " (selected)" : ""}`}
        aria-pressed={selected}
        className="flex min-w-0 flex-1 items-center gap-1.5 rounded px-0.5 py-0.5 text-left focus-visible:outline-2 focus-visible:outline-gold"
      >
        <LayerThumb layer={layer} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[10.5px] font-medium text-cream-dim">
            {layer.name}
          </span>
          <span className="block text-[8px] uppercase tracking-[0.08em] text-muted">
            {layer.type} · {displayIndex}
            {layer.locked ? " · locked" : ""}
          </span>
        </span>
      </button>
      <Hint label={layer.locked ? "Unlock layer" : "Lock layer"}>
        <button
          type="button"
          aria-label={`${layer.locked ? "Unlock" : "Lock"} ${layer.name}`}
          aria-pressed={layer.locked}
          onClick={() => toggleLock(layer.id)}
          className={cn(
            "rounded p-1 transition-colors hover:bg-ink-700 focus-visible:outline-2 focus-visible:outline-gold",
            layer.locked ? "text-gold" : "text-muted-dim hover:text-cream",
          )}
        >
          {layer.locked ? (
            <Lock className="h-3 w-3" aria-hidden="true" />
          ) : (
            <Unlock className="h-3 w-3" aria-hidden="true" />
          )}
        </button>
      </Hint>
      <DropdownMenuRoot>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`More actions for ${layer.name}`}
            className="rounded p-1 text-muted transition-colors hover:bg-ink-700 hover:text-cream focus-visible:outline-2 focus-visible:outline-gold"
          >
            <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          <DropdownMenuItem
            icon={<ArrowUp className="h-3 w-3" />}
            onSelect={() => reorderLayer(layer.id, 1)}
          >
            Move up
          </DropdownMenuItem>
          <DropdownMenuItem
            icon={<ArrowDown className="h-3 w-3" />}
            onSelect={() => reorderLayer(layer.id, -1)}
          >
            Move down
          </DropdownMenuItem>
          <DropdownMenuItem
            icon={<ChevronsUp className="h-3 w-3" />}
            onSelect={() => bringLayerToFront(layer.id)}
          >
            Bring to front
          </DropdownMenuItem>
          <DropdownMenuItem
            icon={<ChevronsDown className="h-3 w-3" />}
            onSelect={() => sendLayerToBack(layer.id)}
          >
            Send to back
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            icon={<Copy className="h-3 w-3" />}
            onSelect={() => {
              select(layer.id);
              duplicateSelected();
            }}
          >
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem
            icon={<Trash2 className="h-3 w-3" />}
            destructive
            disabled={layer.locked}
            onSelect={() => {
              const ok = deleteLayer(layer.id);
              if (!ok) notify.info("Layer not deleted", "Unlock the layer first.");
            }}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenuRoot>
    </li>
  );
}

export function LayersPanel() {
  const layers = useEditorStore((state) => state.scene.layers);
  const addText = useEditorStore((state) => state.addText);
  const moveLayer = useEditorStore((state) => state.moveLayer);
  const [dragging, setDragging] = useState<string | null>(null);
  const displayed = [...layers].reverse();

  const handleDropOn = (targetId: string) => {
    if (!dragging || dragging === targetId) {
      setDragging(null);
      return;
    }
    const targetIndex = layers.findIndex((layer) => layer.id === targetId);
    if (targetIndex >= 0) moveLayer(dragging, targetIndex);
    setDragging(null);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2.5">
        <div>
          <h2 className="panel-title">Layers</h2>
          <p className="mt-0.5 text-[9px] text-muted">Top layer renders last</p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            const id = addText();
            if (!id) notify.error("Layer limit reached", "Delete a layer before adding another.");
          }}
        >
          <Plus className="h-3 w-3" aria-hidden="true" />
          Text
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {layers.length === 0 ? (
          <div className="rounded-md border border-dashed border-line-strong px-4 py-10 text-center">
            <Layers className="mx-auto h-6 w-6 text-muted" aria-hidden="true" />
            <p className="mt-2 text-xs font-medium text-cream">No layers yet</p>
            <p className="mt-1 text-[10px] leading-snug text-muted">
              Add artwork from the library or press T to create a text layer.
            </p>
          </div>
        ) : (
          <ul className="space-y-0.5" aria-label="Layers, top layer first">
            {displayed.map((layer, index) => (
              <LayerRow
                key={layer.id}
                layer={layer}
                displayIndex={index + 1}
                dragging={dragging}
                setDragging={setDragging}
                onDropOn={handleDropOn}
              />
            ))}
          </ul>
        )}
      </div>
      <div className="border-t border-line px-3 py-2 text-[9px] text-muted">
        {layers.length} / 120 layers · drag rows to reorder
      </div>
    </div>
  );
}
