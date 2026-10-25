import { ColorField, SliderField, SwitchField, NumberField } from "@/components/ui/controls";
import type { Layer, LayerEffects } from "@/features/editor/types";
import type { EffectsPatch } from "@/features/editor/sceneOps";

export interface EffectsControlsProps {
  layer: Layer;
  disabled: boolean;
  onChange: (effects: EffectsPatch, key: string) => void;
}

export function EffectsControls({ layer, disabled, onChange }: EffectsControlsProps) {
  const effects: LayerEffects = layer.effects;
  return (
    <div className="space-y-2.5">
      <div className="rounded border border-line bg-ink-800/50 p-2.5">
        <SwitchField
          label="Outline"
          checked={effects.outline.enabled}
          disabled={disabled}
          onCheckedChange={(enabled) =>
            onChange({ outline: { enabled } }, `outline-enabled:${layer.id}`)
          }
          hint={
            layer.type === "image"
              ? "Silhouette outline around the sprite"
              : "Stroke around the letterforms"
          }
        />
        {effects.outline.enabled ? (
          <div className="mt-2.5 grid grid-cols-[1fr_1fr] gap-2">
            <ColorField
              label="Color"
              value={effects.outline.color}
              disabled={disabled}
              onValueChange={(color) =>
                onChange({ outline: { color } }, `outline-color:${layer.id}`)
              }
            />
            <NumberField
              label="Width"
              value={effects.outline.width}
              min={0}
              max={32}
              step={0.5}
              suffix="px"
              disabled={disabled}
              onValueChange={(width) =>
                onChange({ outline: { width } }, `outline-width:${layer.id}`)
              }
            />
          </div>
        ) : null}
      </div>

      <div className="rounded border border-line bg-ink-800/50 p-2.5">
        <SwitchField
          label="Drop shadow"
          checked={effects.shadow.enabled}
          disabled={disabled}
          onCheckedChange={(enabled) =>
            onChange({ shadow: { enabled } }, `shadow-enabled:${layer.id}`)
          }
        />
        {effects.shadow.enabled ? (
          <div className="mt-2.5 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <ColorField
                label="Color"
                value={effects.shadow.color}
                disabled={disabled}
                onValueChange={(color) =>
                  onChange({ shadow: { color } }, `shadow-color:${layer.id}`)
                }
              />
              <SliderField
                label="Opacity"
                value={Math.round(effects.shadow.opacity * 100)}
                min={0}
                max={100}
                onValueChange={(value) =>
                  onChange({ shadow: { opacity: value / 100 } }, `shadow-opacity:${layer.id}`)
                }
                formatValue={(value) => `${value}%`}
                disabled={disabled}
              />
            </div>
            <SliderField
              label="Blur"
              value={effects.shadow.blur}
              min={0}
              max={100}
              onValueChange={(blur) => onChange({ shadow: { blur } }, `shadow-blur:${layer.id}`)}
              formatValue={(value) => `${value}px`}
              disabled={disabled}
            />
            <div className="grid grid-cols-2 gap-2">
              <NumberField
                label="Offset X"
                value={effects.shadow.offsetX}
                min={-100}
                max={100}
                suffix="px"
                disabled={disabled}
                onValueChange={(offsetX) =>
                  onChange({ shadow: { offsetX } }, `shadow-x:${layer.id}`)
                }
              />
              <NumberField
                label="Offset Y"
                value={effects.shadow.offsetY}
                min={-100}
                max={100}
                suffix="px"
                disabled={disabled}
                onValueChange={(offsetY) =>
                  onChange({ shadow: { offsetY } }, `shadow-y:${layer.id}`)
                }
              />
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded border border-line bg-ink-800/50 p-2.5">
        <SwitchField
          label="Glow"
          checked={effects.glow.enabled}
          disabled={disabled}
          onCheckedChange={(enabled) => onChange({ glow: { enabled } }, `glow-enabled:${layer.id}`)}
          hint="Colored halo behind the layer"
        />
        {effects.glow.enabled ? (
          <div className="mt-2.5 space-y-2">
            <ColorField
              label="Color"
              value={effects.glow.color}
              disabled={disabled}
              onValueChange={(color) => onChange({ glow: { color } }, `glow-color:${layer.id}`)}
            />
            <div className="grid grid-cols-2 gap-2">
              <SliderField
                label="Blur"
                value={effects.glow.blur}
                min={0}
                max={120}
                onValueChange={(blur) => onChange({ glow: { blur } }, `glow-blur:${layer.id}`)}
                formatValue={(value) => `${value}px`}
                disabled={disabled}
              />
              <SliderField
                label="Opacity"
                value={Math.round(effects.glow.opacity * 100)}
                min={0}
                max={100}
                onValueChange={(value) =>
                  onChange({ glow: { opacity: value / 100 } }, `glow-opacity:${layer.id}`)
                }
                formatValue={(value) => `${value}%`}
                disabled={disabled}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
