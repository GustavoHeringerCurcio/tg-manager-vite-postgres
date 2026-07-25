import { useState, useEffect, useRef } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import MessageFlowEditor from "./MessageFlowEditor";
import type { RemarketingConfig } from "@/types";
import { Timer, Clock, Zap } from "lucide-react";

interface RemarketingEditorProps {
  config: RemarketingConfig;
  onChange: (config: RemarketingConfig) => void;
  livepixConfigured?: boolean;
}

const PRESETS = [
  { label: "1min", value: 60_000 },
  { label: "15min", value: 900_000 },
  { label: "30min", value: 1_800_000 },
  { label: "1h", value: 3_600_000 },
  { label: "3h", value: 10_800_000 },
  { label: "6h", value: 21_600_000 },
  { label: "12h", value: 43_200_000 },
  { label: "24h", value: 86_400_000 },
  { label: "3d", value: 259_200_000 },
  { label: "7d", value: 604_800_000 },
];

const UNITS: { value: number; label: string }[] = [
  { value: 60, label: "minute" },
  { value: 3600, label: "hour" },
  { value: 86400, label: "day" },
];

const DURATION_UNITS: { value: number; label: string }[] = [
  { value: 3600000, label: "hours" },
  { value: 86400000, label: "days" },
];

function matchingPreset(ms: number): number | null {
  const preset = PRESETS.find(p => p.value === ms);
  return preset ? preset.value : null;
}

function deriveDisplay(ms: number): { number: number; unit: number } {
  if (ms >= 86400 * 1000 && ms % (86400 * 1000) === 0) return { number: Math.round(ms / 1000 / 86400), unit: 86400 };
  if (ms >= 3600 * 1000 && ms % (3600 * 1000) === 0) return { number: Math.round(ms / 1000 / 3600), unit: 3600 };
  const number = Math.round(ms / 1000 / 60);
  if (number >= 1) return { number, unit: 60 };
  return { number: 1, unit: 60 };
}

function toMs(number: number, unit: number): number {
  return number * unit * 1000;
}

function scheduleHelpText(ms: number): string {
  if (ms <= 0) return "";
  const minutes = ms / 60_000;
  const hours = minutes / 60;
  const days = hours / 24;

  let value: number;
  let unitLabel: string;

  if (Number.isInteger(days) && days >= 1) {
    value = days;
    unitLabel = `day${days > 1 ? "s" : ""}`;
  } else if (Number.isInteger(hours) && hours >= 1) {
    value = hours;
    unitLabel = `hour${hours > 1 ? "s" : ""}`;
  } else {
    value = minutes;
    unitLabel = `minute${minutes > 1 ? "s" : ""}`;
  }

  return `Messages will be sent every ${value} ${unitLabel}`;
}

function deriveDurationDisplay(ms: number): { number: number; unit: number } {
  if (ms <= 0) return { number: 1, unit: 86400000 };
  if (ms >= 86400000 && ms % 86400000 === 0) return { number: Math.round(ms / 86400000), unit: 86400000 };
  return { number: Math.round(ms / 3600000), unit: 3600000 };
}

function durationToMs(number: number, unit: number): number {
  return number * unit;
}

export default function RemarketingEditor({ config, onChange }: RemarketingEditorProps) {
  const activePreset = matchingPreset(config.intervalMs);
  const [isCustom, setIsCustom] = useState(() => activePreset === null);
  const [customNumber, setCustomNumber] = useState(() => {
    if (config.intervalMs <= 0) return 1;
    return deriveDisplay(config.intervalMs).number;
  });
  const [customUnit, setCustomUnit] = useState(() => {
    if (config.intervalMs <= 0) return 60;
    return deriveDisplay(config.intervalMs).unit;
  });

  const burstIntervalMs = config.burstIntervalMs ?? 0;
  const burstActivePreset = matchingPreset(burstIntervalMs);
  const [burstIsCustom, setBurstIsCustom] = useState(() => burstActivePreset === null && burstIntervalMs > 0);
  const [burstCustomNumber, setBurstCustomNumber] = useState(() => {
    if (burstIntervalMs <= 0) return 1;
    return deriveDisplay(burstIntervalMs).number;
  });
  const [burstCustomUnit, setBurstCustomUnit] = useState(() => {
    if (burstIntervalMs <= 0) return 60;
    return deriveDisplay(burstIntervalMs).unit;
  });

  const burstDurationMs = config.burstDurationMs ?? 0;
  const durationDisplay = deriveDurationDisplay(burstDurationMs);
  const [burstDurationNumber, setBurstDurationNumber] = useState(durationDisplay.number);
  const [burstDurationUnit, setBurstDurationUnit] = useState(durationDisplay.unit);

  const burstEnabled = (config.burstIntervalMs ?? 0) > 0;

  const selfUpdateRef = useRef(false);

  useEffect(() => {
    if (selfUpdateRef.current) {
      selfUpdateRef.current = false;
      return;
    }
    const preset = matchingPreset(config.intervalMs);
    if (preset !== null) {
      setIsCustom(false);
    } else if (config.intervalMs > 0) {
      setIsCustom(true);
      const display = deriveDisplay(config.intervalMs);
      setCustomNumber(display.number);
      setCustomUnit(display.unit);
    }
  }, [config.intervalMs]);

  function update(fields: Partial<RemarketingConfig>) {
    selfUpdateRef.current = true;
    onChange({ ...config, ...fields });
  }

  function selectPreset(ms: number) {
    setIsCustom(false);
    update({ intervalMs: ms });
  }

  function enableCustom() {
    setIsCustom(true);
  }

  function updateCustomNumber(n: number) {
    if (!Number.isFinite(n) || n < 1) return;
    setCustomNumber(n);
    update({ intervalMs: toMs(n, customUnit) });
  }

  function updateCustomUnit(unit: number) {
    setCustomUnit(unit);
    update({ intervalMs: toMs(customNumber, unit) });
  }

  function selectBurstPreset(ms: number) {
    setBurstIsCustom(false);
    update({ burstIntervalMs: ms });
  }

  function enableBurstCustom() {
    setBurstIsCustom(true);
  }

  function updateBurstCustomNumber(n: number) {
    if (!Number.isFinite(n) || n < 1) return;
    setBurstCustomNumber(n);
    update({ burstIntervalMs: toMs(n, burstCustomUnit) });
  }

  function updateBurstCustomUnit(unit: number) {
    setBurstCustomUnit(unit);
    update({ burstIntervalMs: toMs(burstCustomNumber, unit) });
  }

  function toggleBurst(enabled: boolean) {
    if (enabled) {
      update({
        burstIntervalMs: 300_000,
        burstDurationMs: 172_800_000,
        burstCycleMessages: true,
      });
    } else {
      update({
        burstIntervalMs: 0,
        burstDurationMs: 0,
        useSeparateBurstMessages: false,
        burstMessages: [],
      });
    }
  }

  function updateBurstDurationNumber(n: number) {
    if (!Number.isFinite(n) || n < 1) return;
    setBurstDurationNumber(n);
    update({ burstDurationMs: durationToMs(n, burstDurationUnit) });
  }

  function updateBurstDurationUnit(unit: number) {
    setBurstDurationUnit(unit);
    update({ burstDurationMs: durationToMs(burstDurationNumber, unit) });
  }

  const helpText = scheduleHelpText(config.intervalMs);
  const burstHelpText = burstEnabled ? `Every ${scheduleHelpText(burstIntervalMs).replace("Messages will be sent ", "").replace(" every", "")} during burst phase` : "";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-amber-500/10 ring-1 ring-amber-500/20 mt-0.5">
            <Timer className="size-4 text-amber-400" />
          </div>
          <div>
            <Label className="text-sm font-semibold">Remarketing</Label>
            <p className="text-xs text-muted-foreground">
              Send follow-up messages automatically after initial interaction
            </p>
          </div>
        </div>
        <Switch
          checked={config.enabled}
          onCheckedChange={(v) => update({ enabled: v })}
        />
      </div>

      {config.enabled && (
        <div className="space-y-4 animate-fade-in">
          <div className="space-y-3">
            <Label className="text-xs">Schedule</Label>
            <div className="flex flex-wrap gap-1">
              {PRESETS.map((p) => (
                <Button
                  key={p.value}
                  size="xs"
                  variant={!isCustom && activePreset === p.value ? "default" : "outline"}
                  onClick={() => selectPreset(p.value)}
                >
                  {p.label}
                </Button>
              ))}
              <Button
                size="xs"
                variant={isCustom ? "default" : "outline"}
                onClick={enableCustom}
              >
                Custom
              </Button>
            </div>
            {isCustom && (
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={1}
                  value={customNumber}
                  onChange={(e) => updateCustomNumber(Number(e.target.value))}
                  className="h-8 w-20 text-sm"
                />
                <Select
                  value={String(customUnit)}
                  onValueChange={(v) => updateCustomUnit(Number(v))}
                >
                  <SelectTrigger className="h-8 w-24 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => (
                      <SelectItem key={u.value} value={String(u.value)}>{u.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {helpText && (
              <p className="text-[0.7rem] text-muted-foreground">{helpText}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Max Sends (0 = unlimited)</Label>
            <Input
              type="number"
              min={0}
              value={config.maxSends}
              onChange={(e) => update({ maxSends: Number(e.target.value) })}
              className="h-8 text-sm w-28"
            />
          </div>

          <MessageFlowEditor
            steps={config.messages}
            onChange={(messages) => update({ messages })}
          />

          <div className="space-y-2">
            <Label className="text-xs">Initial Delay (ms, 0 = immediate)</Label>
            <Input
              type="number"
              min={0}
              value={config.initialDelayMs ?? config.intervalMs}
              onChange={(e) => update({ initialDelayMs: Number(e.target.value) })}
              className="h-8 text-sm w-36"
            />
            <p className="text-[0.7rem] text-muted-foreground">
              Time before the first follow-up is sent (defaults to schedule interval)
            </p>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-purple-500/10 ring-1 ring-purple-500/20 mt-0.5">
                <Clock className="size-4 text-purple-400" />
              </div>
              <div>
                <Label className="text-sm font-semibold">Skip Stale Messages</Label>
                <p className="text-xs text-muted-foreground">
                  Skip messages that are more than 2× overdue (e.g. after server downtime)
                </p>
              </div>
            </div>
            <Switch
              checked={config.skipStale ?? false}
              onCheckedChange={(v) => update({ skipStale: v })}
            />
          </div>

          <div className="border-t border-border pt-4 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-yellow-500/10 ring-1 ring-yellow-500/20 mt-0.5">
                  <Zap className="size-4 text-yellow-400" />
                </div>
                <div>
                  <Label className="text-sm font-semibold">Burst Phase</Label>
                  <p className="text-xs text-muted-foreground">
                    Fast initial interval for a limited duration, then switch to normal schedule
                  </p>
                </div>
              </div>
              <Switch
                checked={burstEnabled}
                onCheckedChange={(v) => toggleBurst(v)}
              />
            </div>

            {burstEnabled && (
              <div className="space-y-3 animate-fade-in">
                <div className="space-y-2">
                  <Label className="text-xs">Burst Interval</Label>
                  <div className="flex flex-wrap gap-1">
                    {PRESETS.map((p) => (
                      <Button
                        key={p.value}
                        size="xs"
                        variant={!burstIsCustom && burstActivePreset === p.value ? "default" : "outline"}
                        onClick={() => selectBurstPreset(p.value)}
                      >
                        {p.label}
                      </Button>
                    ))}
                    <Button
                      size="xs"
                      variant={burstIsCustom ? "default" : "outline"}
                      onClick={enableBurstCustom}
                    >
                      Custom
                    </Button>
                  </div>
                  {burstIsCustom && (
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min={1}
                        value={burstCustomNumber}
                        onChange={(e) => updateBurstCustomNumber(Number(e.target.value))}
                        className="h-8 w-20 text-sm"
                      />
                      <Select
                        value={String(burstCustomUnit)}
                        onValueChange={(v) => updateBurstCustomUnit(Number(v))}
                      >
                        <SelectTrigger className="h-8 w-24 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {UNITS.map((u) => (
                            <SelectItem key={u.value} value={String(u.value)}>{u.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {burstHelpText && (
                    <p className="text-[0.7rem] text-muted-foreground">{burstHelpText}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Burst Duration</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min={1}
                      value={burstDurationNumber}
                      onChange={(e) => updateBurstDurationNumber(Number(e.target.value))}
                      className="h-8 w-20 text-sm"
                    />
                    <Select
                      value={String(burstDurationUnit)}
                      onValueChange={(v) => updateBurstDurationUnit(Number(v))}
                    >
                      <SelectTrigger className="h-8 w-24 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DURATION_UNITS.map((u) => (
                          <SelectItem key={u.value} value={String(u.value)}>{u.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-[0.7rem] text-muted-foreground">
                    Burst starts when user sends /start and lasts for this duration
                  </p>
                </div>

                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Label className="text-xs">Cycle Messages During Burst</Label>
                    <p className="text-[0.7rem] text-muted-foreground">
                      When off, sends each message once then stops until burst ends
                    </p>
                  </div>
                  <Switch
                    checked={config.burstCycleMessages ?? true}
                    onCheckedChange={(v) => update({ burstCycleMessages: v })}
                  />
                </div>

                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Label className="text-xs">Use Separate Burst Messages</Label>
                    <p className="text-[0.7rem] text-muted-foreground">
                      When off, reuses main remarketing messages ({config.messages.length} messages)
                    </p>
                  </div>
                  <Switch
                    checked={config.useSeparateBurstMessages ?? false}
                    onCheckedChange={(v) => update({ useSeparateBurstMessages: v })}
                  />
                </div>

                {(config.useSeparateBurstMessages ?? false) && (
                  <div className="animate-fade-in">
                    <MessageFlowEditor
                      steps={config.burstMessages ?? []}
                      onChange={(burstMessages) => update({ burstMessages })}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
