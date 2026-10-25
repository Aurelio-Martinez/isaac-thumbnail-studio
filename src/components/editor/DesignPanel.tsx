import { useEditorStore } from "@/features/editor/store";
import { BackgroundPanel } from "@/components/editor/BackgroundPanel";
import { LayerProperties, MultiSelectionPanel } from "@/components/editor/LayerProperties";

export function DesignPanel() {
  const layers = useEditorStore((state) => state.scene.layers);
  const selectedIds = useEditorStore((state) => state.selectedIds);
  const selected = layers.filter((layer) => selectedIds.includes(layer.id));

  if (selected.length === 0) return <BackgroundPanel />;
  if (selected.length > 1) return <MultiSelectionPanel layers={selected} />;
  return <LayerProperties layer={selected[0]!} />;
}
