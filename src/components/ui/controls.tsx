import * as SliderPrimitive from "@radix-ui/react-slider";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { useId, useState, type ReactNode } from "react";
import { cn, clamp, round } from "@/lib/utils";

interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onValueChange: (value: number) => void;
  formatValue?: (value: number) => string;
  disabled?: boolean;
  className?: string;
}

export function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  onValueChange,
  formatValue,
  disabled,
  className,
}: SliderFieldProps) {
  const id = useId();
  return (
    <div className={cn("min-w-0", className)}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label htmlFor={id} className="field-label mb-0">
          {label}
        </label>
        <output htmlFor={id} className="font-mono text-[10px] text-cream-dim">
          {formatValue ? formatValue(value) : round(value, 2)}
        </output>
      </div>
      <SliderPrimitive.Root
        id={id}
        value={[value]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={(next) => {
          const candidate = next[0];
          if (typeof candidate === "number") onValueChange(candidate);
        }}
        className="relative flex h-5 w-full touch-none select-none items-center disabled:opacity-40"
      >
        <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-ink-650">
          <SliderPrimitive.Range className="absolute h-full bg-gold/80" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          aria-label={label}
          className="block h-3.5 w-3.5 rounded-full border border-gold bg-cream shadow-[0_1px_3px_rgba(0,0,0,0.6)] transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2"
        />
      </SliderPrimitive.Root>
    </div>
  );
}

interface NumberFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onValueChange: (value: number) => void;
  suffix?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onValueChange,
  suffix,
  disabled,
  className,
  id,
}: NumberFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [draft, setDraft] = useState(String(round(value, 2)));
  const [lastValue, setLastValue] = useState(value);

  if (value !== lastValue) {
    setLastValue(value);
    if (Number(draft) !== value) setDraft(String(round(value, 2)));
  }

  const commit = (raw: string) => {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      setDraft(String(round(value, 2)));
      return;
    }
    const next = clamp(round(parsed, 2), min, max);
    setDraft(String(next));
    if (next !== value) onValueChange(next);
  };

  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={inputId} className="field-label">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type="number"
          inputMode="decimal"
          className="control pr-10 font-mono text-[12px] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          value={draft}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(event) => {
            const next = event.target.value;
            setDraft(next);
            const parsed = Number(next);
            if (Number.isFinite(parsed) && parsed >= min && parsed <= max) {
              onValueChange(round(parsed, 2));
            }
          }}
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit((event.target as HTMLInputElement).value);
              (event.target as HTMLInputElement).blur();
            }
          }}
        />
        {suffix ? (
          <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center font-mono text-[10px] text-muted">
            {suffix}
          </span>
        ) : null}
      </div>
    </div>
  );
}

interface ColorFieldProps {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

export function ColorField({ label, value, onValueChange, className, disabled }: ColorFieldProps) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(value);
  }
  const commit = (raw: string) => {
    const withHash = raw.startsWith("#") ? raw : `#${raw}`;
    if (HEX.test(withHash)) {
      onValueChange(withHash.toLowerCase());
      setDraft(withHash.toLowerCase());
    } else {
      setDraft(value);
    }
  };
  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="color"
          aria-label={`${label} color picker`}
          value={HEX.test(value) ? value : "#000000"}
          disabled={disabled}
          onChange={(event) => onValueChange(event.target.value)}
          className="h-8 w-9 shrink-0 cursor-pointer rounded border border-line bg-ink-950"
        />
        <input
          aria-label={`${label} hex value`}
          className="control font-mono text-[11px] uppercase"
          value={draft}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit((event.target as HTMLInputElement).value);
              (event.target as HTMLInputElement).blur();
            }
          }}
          maxLength={7}
          spellCheck={false}
        />
      </div>
    </div>
  );
}

export function SwitchField({
  label,
  checked,
  onCheckedChange,
  hint,
  disabled,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  hint?: ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <label htmlFor={id} className="cursor-pointer text-[11px] font-medium text-cream-dim">
          {label}
        </label>
        {hint ? <p className="text-[10px] text-muted">{hint}</p> : null}
      </div>
      <SwitchPrimitive.Root
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        className={cn(
          "relative h-[18px] w-8 shrink-0 rounded-full border transition-colors",
          checked ? "border-gold/70 bg-gold/80" : "border-line-strong bg-ink-700",
        )}
      >
        <SwitchPrimitive.Thumb
          className={cn(
            "block h-3 w-3 rounded-full bg-cream shadow transition-transform",
            checked ? "translate-x-[15px] bg-ink-950" : "translate-x-[2px]",
          )}
        />
      </SwitchPrimitive.Root>
    </div>
  );
}
