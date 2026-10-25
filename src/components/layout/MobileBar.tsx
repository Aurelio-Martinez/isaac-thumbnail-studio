import {
  Image as ImageIcon,
  Layers,
  LayoutTemplate,
  Maximize2,
  SlidersHorizontal,
} from "lucide-react";
import { useUiStore } from "@/features/editor/uiStore";
import { cn } from "@/lib/utils";

export function MobileBar() {
  const mobilePanel = useUiStore((state) => state.mobilePanel);
  const setMobilePanel = useUiStore((state) => state.setMobilePanel);
  const inspectorTab = useUiStore((state) => state.inspectorTab);
  const setInspectorTab = useUiStore((state) => state.setInspectorTab);
  const requestFit = useUiStore((state) => state.requestFit);

  const openInspector = (tab: "design" | "layers" | "presets") => {
    setInspectorTab(tab);
    setMobilePanel(mobilePanel === "inspector" && inspectorTab === tab ? null : "inspector");
  };

  const items = [
    {
      id: "assets",
      label: "Artwork",
      icon: ImageIcon,
      active: mobilePanel === "assets",
      action: () => setMobilePanel(mobilePanel === "assets" ? null : "assets"),
      className: "lg:hidden",
    },
    {
      id: "design",
      label: "Design",
      icon: SlidersHorizontal,
      active: mobilePanel === "inspector" && inspectorTab === "design",
      action: () => openInspector("design"),
    },
    {
      id: "layers",
      label: "Layers",
      icon: Layers,
      active: mobilePanel === "inspector" && inspectorTab === "layers",
      action: () => openInspector("layers"),
    },
    {
      id: "presets",
      label: "Presets",
      icon: LayoutTemplate,
      active: mobilePanel === "inspector" && inspectorTab === "presets",
      action: () => openInspector("presets"),
    },
    {
      id: "fit",
      label: "Fit",
      icon: Maximize2,
      active: false,
      action: requestFit,
    },
  ] as const;

  return (
    <nav
      aria-label="Editor panels"
      className="flex shrink-0 items-stretch border-t border-line bg-ink-900 pb-[env(safe-area-inset-bottom)] xl:hidden"
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={item.active}
            onClick={item.action}
            className={cn(
              "flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 text-[9px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-gold",
              item.active ? "text-gold" : "text-muted hover:text-cream",
              "className" in item ? item.className : undefined,
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
