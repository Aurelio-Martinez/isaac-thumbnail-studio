import { Layers, LayoutTemplate, SlidersHorizontal } from "lucide-react";
import { useUiStore, type InspectorTab } from "@/features/editor/uiStore";
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from "@/components/ui/form";
import { DesignPanel } from "@/components/editor/DesignPanel";
import { LayersPanel } from "@/components/editor/LayersPanel";
import { PresetsPanel } from "@/components/editor/PresetsPanel";

export function Inspector() {
  const tab = useUiStore((state) => state.inspectorTab);
  const setTab = useUiStore((state) => state.setInspectorTab);

  return (
    <TabsRoot
      value={tab}
      onValueChange={(value) => setTab(value as InspectorTab)}
      className="flex h-full min-h-0 flex-col"
    >
      <TabsList className="shrink-0 pt-0.5" aria-label="Inspector sections">
        <TabsTrigger value="design" className="flex-1 justify-center">
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          Design
        </TabsTrigger>
        <TabsTrigger value="layers" className="flex-1 justify-center">
          <Layers className="h-3.5 w-3.5" aria-hidden="true" />
          Layers
        </TabsTrigger>
        <TabsTrigger value="presets" className="flex-1 justify-center">
          <LayoutTemplate className="h-3.5 w-3.5" aria-hidden="true" />
          Presets
        </TabsTrigger>
      </TabsList>
      <TabsContent
        value="design"
        className="min-h-0 flex-1 overflow-y-auto focus-visible:outline-none"
      >
        <DesignPanel />
      </TabsContent>
      <TabsContent
        value="layers"
        className="min-h-0 flex-1 overflow-hidden focus-visible:outline-none"
      >
        <LayersPanel />
      </TabsContent>
      <TabsContent
        value="presets"
        className="min-h-0 flex-1 overflow-hidden focus-visible:outline-none"
      >
        <PresetsPanel />
      </TabsContent>
    </TabsRoot>
  );
}
