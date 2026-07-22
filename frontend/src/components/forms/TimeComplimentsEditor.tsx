import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TimeComplimentConfig, TimeComplimentPreset } from "@/types";
import { Clock, Plus, X, Info } from "lucide-react";

const COMMON_TIMEZONES = [
  { value: "America/Sao_Paulo", label: "Brasília (GMT-3)" },
  { value: "America/New_York", label: "New York (GMT-5)" },
  { value: "America/Chicago", label: "Chicago (GMT-6)" },
  { value: "America/Denver", label: "Denver (GMT-7)" },
  { value: "America/Los_Angeles", label: "Los Angeles (GMT-8)" },
  { value: "Europe/London", label: "London (GMT+1)" },
  { value: "Europe/Paris", label: "Paris (GMT+2)" },
  { value: "Europe/Berlin", label: "Berlin (GMT+2)" },
  { value: "Europe/Moscow", label: "Moscow (GMT+3)" },
  { value: "Asia/Dubai", label: "Dubai (GMT+4)" },
  { value: "Asia/Kolkata", label: "Mumbai (GMT+5:30)" },
  { value: "Asia/Jakarta", label: "Jakarta (GMT+7)" },
  { value: "Asia/Shanghai", label: "Shanghai (GMT+8)" },
  { value: "Asia/Tokyo", label: "Tokyo (GMT+9)" },
  { value: "Australia/Sydney", label: "Sydney (GMT+10)" },
  { value: "Pacific/Auckland", label: "Auckland (GMT+12)" },
  { value: "Africa/Lagos", label: "Lagos (GMT+1)" },
  { value: "America/Mexico_City", label: "Mexico City (GMT-6)" },
  { value: "America/Argentina/Buenos_Aires", label: "Buenos Aires (GMT-3)" },
  { value: "Europe/Lisbon", label: "Lisbon (GMT+1)" },
];

const defaultPreset = (): TimeComplimentPreset => ({
  label: "Good Morning",
  startHour: 5,
  startMinute: 0,
  endHour: 11,
  endMinute: 59,
});

interface TimeComplimentsEditorProps {
  config: TimeComplimentConfig;
  onChange: (config: TimeComplimentConfig) => void;
}

export default function TimeComplimentsEditor({ config, onChange }: TimeComplimentsEditorProps) {
  function update(fields: Partial<TimeComplimentConfig>) {
    onChange({ ...config, ...fields });
  }

  function updatePreset(index: number, preset: TimeComplimentPreset) {
    const presets = [...config.presets];
    presets[index] = preset;
    update({ presets });
  }

  function addPreset() {
    update({ presets: [...config.presets, defaultPreset()] });
  }

  function removePreset(index: number) {
    const presets = config.presets.filter((_, i) => i !== index);
    update({ presets });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-sky-500/10 ring-1 ring-sky-500/20 mt-0.5">
          <Clock className="size-4 text-sky-400" />
        </div>
        <div>
          <Label className="text-sm font-semibold">Time Compliments</Label>
          <p className="text-xs text-muted-foreground">
            Define time-based greetings that resolve via <code className="text-[11px] bg-muted px-1 rounded">{`{time_compliment}`}</code> placeholder
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Default Timezone</Label>
        <Select
          value={config.timezone}
          onValueChange={(v) => update({ timezone: v ?? "America/Sao_Paulo" })}
        >
          <SelectTrigger className="h-8 w-full max-w-xs text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COMMON_TIMEZONES.map((tz) => (
              <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Global Fallback</Label>
        <Input
          value={config.fallback}
          onChange={(e) => update({ fallback: e.target.value })}
          className="h-8 text-sm max-w-xs"
          placeholder="e.g., Hey"
        />
        <p className="text-[10px] text-muted-foreground/60">
          Used when no time range matches the current time.
        </p>
      </div>

      {config.presets.length > 0 && (
        <div className="space-y-3">
          {config.presets.map((preset, index) => (
            <div
              key={index}
              className="rounded-lg border border-border/40 bg-card/50 px-4 py-3 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Preset #{index + 1}</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removePreset(index)}
                >
                  <X className="size-3.5" />
                </Button>
              </div>

              <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">Label (shown when time matches)</Label>
                  <Input
                    value={preset.label}
                    onChange={(e) => updatePreset(index, { ...preset, label: e.target.value })}
                    className="h-8 text-sm"
                    placeholder="e.g., Good Morning"
                  />
                </div>

                <div>
                <Label className="text-[11px] text-muted-foreground mb-1.5 block">Time Range (HH:MM)</Label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={0}
                      max={23}
                      value={preset.startHour}
                      onChange={(e) => updatePreset(index, { ...preset, startHour: Math.min(23, Math.max(0, Number(e.target.value) || 0)) })}
                      className="h-8 w-14 text-sm text-center"
                      placeholder="HH"
                    />
                    <span className="text-sm text-muted-foreground">:</span>
                    <Input
                      type="number"
                      min={0}
                      max={59}
                      value={preset.startMinute}
                      onChange={(e) => updatePreset(index, { ...preset, startMinute: Math.min(59, Math.max(0, Number(e.target.value) || 0)) })}
                      className="h-8 w-14 text-sm text-center"
                      placeholder="MM"
                    />
                  </div>
                  <span className="text-xs text-muted-foreground mx-1">to</span>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={0}
                      max={23}
                      value={preset.endHour}
                      onChange={(e) => updatePreset(index, { ...preset, endHour: Math.min(23, Math.max(0, Number(e.target.value) || 0)) })}
                      className="h-8 w-14 text-sm text-center"
                      placeholder="HH"
                    />
                    <span className="text-sm text-muted-foreground">:</span>
                    <Input
                      type="number"
                      min={0}
                      max={59}
                      value={preset.endMinute}
                      onChange={(e) => updatePreset(index, { ...preset, endMinute: Math.min(59, Math.max(0, Number(e.target.value) || 0)) })}
                      className="h-8 w-14 text-sm text-center"
                      placeholder="MM"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground/60 mt-1">
                  If end time is smaller than start time (e.g., 22:00 → 04:00), the range spans midnight.
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full h-8 text-xs"
        onClick={addPreset}
      >
        <Plus className="size-3.5 mr-1.5" />
        Add Compliment Preset
      </Button>

      <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-3.5 space-y-2">
        <div className="flex items-center gap-2">
          <Info className="size-3.5 text-sky-400 shrink-0" />
          <p className="text-xs font-medium text-sky-300">Available Placeholders</p>
        </div>
        <div className="space-y-1">
          <div className="flex items-baseline gap-2 text-xs">
            <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono text-emerald-400">{`{time_compliment}`}</code>
            <span className="text-muted-foreground">
              Resolves to the label of the first preset whose time range matches, or the global fallback if none match.
            </span>
          </div>
          {config.presets.length > 0 && (
            <div className="border-t border-border/30 pt-2 mt-2 space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground/70 uppercase mb-1">Configured Presets</p>
              {config.presets.map((preset, i) => (
                <div key={i} className="flex items-baseline gap-2 text-xs">
                  <span className="text-muted-foreground">
                    &quot;{preset.label}&quot; ({String(preset.startHour).padStart(2, "0")}:{String(preset.startMinute).padStart(2, "0")}–{String(preset.endHour).padStart(2, "0")}:{String(preset.endMinute).padStart(2, "0")})
                  </span>
                </div>
              ))}
            </div>
          )}
          {config.presets.length === 0 && (
            <p className="text-xs text-muted-foreground/60 italic pl-1">
              Add presets above to see them here
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
