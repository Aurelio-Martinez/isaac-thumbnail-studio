import { useState } from "react";
import { LayoutTemplate, Sparkles } from "lucide-react";
import { useEditorStore } from "@/features/editor/store";
import {
  DEFAULT_PRESET_OPTIONS,
  LAYOUT_PRESETS,
  type LayoutPresetId,
  type PresetOptions,
  type TextPosition,
} from "@/features/editor/presets";
import { Button } from "@/components/ui/button";
import { SliderField } from "@/components/ui/controls";
import { Select } from "@/components/ui/form";
import { notify } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

function PresetDiagram({ id }: { id: LayoutPresetId }) {
  const box = "absolute rounded-[1px] bg-ink-650 border border-white/5";
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded border border-line bg-ink-900">
      {id === "hero-left" ? (
        <>
          <div className={cn(box, "left-[8%] top-[28%] h-[58%] w-[26%] bg-ember/70")} />
          <div className={cn(box, "left-[52%] top-[24%] h-[8%] w-[40%] bg-cream/35")} />
          <div className={cn(box, "left-[49%] top-[40%] h-[20%] w-[18%] bg-gold/50")} />
          <div className={cn(box, "left-[72%] top-[40%] h-[20%] w-[18%] bg-gold/50")} />
          <div className={cn(box, "left-[49%] top-[66%] h-[20%] w-[18%] bg-gold/50")} />
          <div className={cn(box, "left-[72%] top-[66%] h-[20%] w-[18%] bg-gold/50")} />
        </>
      ) : null}
      {id === "hero-center" ? (
        <>
          <div className={cn(box, "left-[38%] top-[25%] h-[65%] w-[24%] bg-ember/70")} />
          <div className={cn(box, "left-[24%] top-[30%] h-[16%] w-[12%] bg-gold/50")} />
          <div className={cn(box, "left-[64%] top-[30%] h-[16%] w-[12%] bg-gold/50")} />
          <div className={cn(box, "left-[20%] top-[62%] h-[16%] w-[12%] bg-gold/50")} />
          <div className={cn(box, "left-[68%] top-[62%] h-[16%] w-[12%] bg-gold/50")} />
          <div className={cn(box, "left-[28%] top-[8%] h-[7%] w-[44%] bg-cream/35")} />
        </>
      ) : null}
      {id === "featured-item" ? (
        <>
          <div className={cn(box, "left-[55%] top-[28%] h-[55%] w-[32%] bg-gold/65")} />
          <div className={cn(box, "left-[10%] top-[20%] h-[13%] w-[18%] bg-cream/25")} />
          <div className={cn(box, "left-[10%] top-[40%] h-[13%] w-[18%] bg-gold/40")} />
          <div className={cn(box, "left-[10%] top-[60%] h-[13%] w-[18%] bg-gold/40")} />
          <div className={cn(box, "left-[12%] top-[76%] h-[18%] w-[14%] bg-ember/60")} />
        </>
      ) : null}
      {id === "item-grid" ? (
        <>
          <div className={cn(box, "left-[8%] top-[22%] h-[30%] w-[24%] bg-ember/70")} />
          <div className={cn(box, "left-[44%] top-[22%] h-[20%] w-[14%] bg-gold/45")} />
          <div className={cn(box, "left-[61%] top-[22%] h-[20%] w-[14%] bg-gold/45")} />
          <div className={cn(box, "left-[78%] top-[22%] h-[20%] w-[14%] bg-gold/45")} />
          <div className={cn(box, "left-[44%] top-[50%] h-[20%] w-[14%] bg-gold/45")} />
          <div className={cn(box, "left-[61%] top-[50%] h-[20%] w-[14%] bg-gold/45")} />
          <div className={cn(box, "left-[78%] top-[50%] h-[20%] w-[14%] bg-gold/45")} />
        </>
      ) : null}
      {id === "text-led" ? (
        <>
          <div className={cn(box, "left-[10%] top-[24%] h-[10%] w-[45%] bg-cream/40")} />
          <div className={cn(box, "left-[10%] top-[38%] h-[10%] w-[38%] bg-cream/30")} />
          <div className={cn(box, "left-[74%] top-[28%] h-[58%] w-[18%] bg-ember/70")} />
          <div className={cn(box, "left-[12%] top-[70%] h-[18%] w-[12%] bg-gold/45")} />
          <div className={cn(box, "left-[28%] top-[70%] h-[18%] w-[12%] bg-gold/45")} />
          <div className={cn(box, "left-[44%] top-[70%] h-[18%] w-[12%] bg-gold/45")} />
        </>
      ) : null}
      {id === "minimal" ? (
        <>
          <div className={cn(box, "left-[30%] top-[28%] h-[58%] w-[26%] bg-ember/70")} />
          <div className={cn(box, "left-[68%] top-[30%] h-[24%] w-[16%] bg-gold/50")} />
          <div className={cn(box, "left-[76%] top-[62%] h-[20%] w-[13%] bg-gold/50")} />
          <div className={cn(box, "left-[22%] top-[8%] h-[8%] w-[52%] bg-cream/35")} />
        </>
      ) : null}
    </div>
  );
}

export function PresetsPanel() {
  const layers = useEditorStore((state) => state.scene.layers);
  const applyPreset = useEditorStore((state) => state.applyPreset);
  const addText = useEditorStore((state) => state.addText);
  const [selected, setSelected] = useState<LayoutPresetId>("hero-left");
  const [options, setOptions] = useState<PresetOptions>(DEFAULT_PRESET_OPTIONS);

  const apply = () => {
    const warnings = applyPreset(selected, options);
    if (warnings.length > 0) {
      notify.info("Preset applied with notes", warnings.join(" "));
    } else {
      notify.success(
        "Preset applied",
        "Artwork references were preserved. Every layer is still editable, and undo is available.",
      );
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-line px-4 py-3">
        <h2 className="panel-title">Composition presets</h2>
        <p className="mt-1 text-[10px] leading-snug text-muted">
          Arrange the layers you already have. Presets never replace artwork, and every change is
          undoable.
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {layers.length === 0 ? (
          <div className="rounded-md border border-dashed border-line-strong px-4 py-8 text-center">
            <LayoutTemplate className="mx-auto h-6 w-6 text-muted" aria-hidden="true" />
            <p className="mt-2 text-xs font-medium text-cream">Add artwork first</p>
            <p className="mt-1 text-[10px] leading-snug text-muted">
              A preset needs at least a character or a few items. Add them from the library, then
              come back.
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => addText({ text: "MY NEW RUN" })}
            >
              Add a headline instead
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Layout preset">
            {LAYOUT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                role="radio"
                aria-checked={selected === preset.id}
                onClick={() => setSelected(preset.id)}
                title={preset.description}
                className={cn(
                  "rounded border p-1.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-gold",
                  selected === preset.id
                    ? "border-gold/70 bg-gold/5"
                    : "border-line bg-ink-800/40 hover:border-line-strong",
                )}
              >
                <PresetDiagram id={preset.id} />
                <span className="mt-1.5 block text-[10px] font-semibold text-cream">
                  {preset.name}
                </span>
                <span className="mt-0.5 block text-[8.5px] leading-tight text-muted">
                  {preset.description}
                </span>
              </button>
            ))}
          </div>
        )}

        {layers.length > 0 ? (
          <>
            <div className="mt-4 space-y-3 rounded border border-line bg-ink-800/40 p-3">
              <p className="panel-title">Composition controls</p>
              <SliderField
                label="Item scale"
                value={Math.round(options.itemScale * 100)}
                min={50}
                max={180}
                onValueChange={(value) =>
                  setOptions((current) => ({ ...current, itemScale: value / 100 }))
                }
                formatValue={(value) => `${value}%`}
              />
              <SliderField
                label="Item spacing"
                value={Math.round(options.itemSpacing * 100)}
                min={50}
                max={200}
                onValueChange={(value) =>
                  setOptions((current) => ({ ...current, itemSpacing: value / 100 }))
                }
                formatValue={(value) => `${value}%`}
              />
              <SliderField
                label="Character scale"
                value={Math.round(options.characterScale * 100)}
                min={50}
                max={180}
                onValueChange={(value) =>
                  setOptions((current) => ({ ...current, characterScale: value / 100 }))
                }
                formatValue={(value) => `${value}%`}
              />
              <div>
                <label htmlFor="preset-text-position" className="field-label">
                  Text position
                </label>
                <Select
                  id="preset-text-position"
                  value={options.textPosition}
                  onChange={(event) =>
                    setOptions((current) => ({
                      ...current,
                      textPosition: event.target.value as TextPosition,
                    }))
                  }
                  className="h-8 text-[11px]"
                >
                  <option value="auto">Auto (preset default)</option>
                  <option value="top">Top</option>
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="bottom">Bottom</option>
                </Select>
              </div>
            </div>

            <Button variant="gold" size="md" className="mt-3 w-full" onClick={apply}>
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Apply {LAYOUT_PRESETS.find((preset) => preset.id === selected)?.name}
            </Button>
            <p className="mt-2 text-[9px] leading-snug text-muted">
              Missing a character or text layer? The preset arranges what exists and explains what
              is missing. Add the missing pieces and apply again.
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}
