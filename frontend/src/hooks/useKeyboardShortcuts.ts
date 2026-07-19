import { useEffect } from "react";

interface ShortcutMap {
  [key: string]: () => void;
}

export function useKeyboardShortcuts(shortcuts: ShortcutMap, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    function handler(e: KeyboardEvent) {
      const isInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement;

      const key = [
        e.ctrlKey || e.metaKey ? "mod" : null,
        e.shiftKey ? "shift" : null,
        e.key.toLowerCase(),
      ]
        .filter(Boolean)
        .join("+");

      if (key.startsWith("mod+") && isInput) {
        const action = shortcuts[key];
        if (action) {
          e.preventDefault();
          action();
        }
        return;
      }

      if (!isInput) {
        const action = shortcuts[key];
        if (action) {
          e.preventDefault();
          action();
        }
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shortcuts, enabled]);
}
