import { useState, useEffect, useCallback } from "react";
import type { ButtonAction, ButtonColor } from "@/types";
import { newId } from "@/lib/helpers";

export type ButtonPreset = {
  id: string;
  name: string;
  label: string;
  action: ButtonAction;
  color: ButtonColor;
  url?: string;
  price?: number;
};

const STORAGE_KEY = "botflix_button_presets";

function loadPresets(): ButtonPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p) =>
        p &&
        typeof p.id === "string" &&
        typeof p.name === "string" &&
        typeof p.label === "string" &&
        typeof p.action === "string" &&
        typeof p.color === "string",
    );
  } catch {
    return [];
  }
}

function savePresets(presets: ButtonPreset[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // localStorage full or unavailable
  }
}

export function useButtonPresets() {
  const [presets, setPresets] = useState<ButtonPreset[]>(() => loadPresets());

  useEffect(() => {
    savePresets(presets);
  }, [presets]);

  const addPreset = useCallback(
    (
      preset: Omit<ButtonPreset, "id">,
    ): ButtonPreset => {
      const created: ButtonPreset = { ...preset, id: newId() };
      setPresets((prev) => [...prev, created]);
      return created;
    },
    [],
  );

  const updatePreset = useCallback(
    (id: string, fields: Partial<Omit<ButtonPreset, "id">>) => {
      setPresets((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...fields } : p)),
      );
    },
    [],
  );

  const deletePreset = useCallback((id: string) => {
    setPresets((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const importPresets = useCallback(
    (incoming: Omit<ButtonPreset, "id">[]): number => {
      const created = incoming.map((p) => ({ ...p, id: newId() }));
      setPresets((prev) => [...prev, ...created]);
      return created.length;
    },
    [],
  );

  const exportPresets = useCallback((): ButtonPreset[] => {
    return presets;
  }, [presets]);

  return {
    presets,
    addPreset,
    updatePreset,
    deletePreset,
    importPresets,
    exportPresets,
  };
}
