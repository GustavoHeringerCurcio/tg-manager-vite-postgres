import { useCallback, useEffect, useRef, useState } from "react";
import type { MessageStep } from "@/types";

interface UndoEntry {
  steps: MessageStep[];
  label: string;
}

export function useUndo(initial: MessageStep[]) {
  const [steps, setSteps] = useState<MessageStep[]>(initial);
  const undoStack = useRef<UndoEntry[]>([]);
  const maxStack = 10;

  useEffect(() => {
    setSteps(initial);
  }, [initial]);

  const push = useCallback(
    (newSteps: MessageStep[], label: string) => {
      undoStack.current = [
        { steps, label },
        ...undoStack.current.slice(0, maxStack - 1),
      ];
      setSteps(newSteps);
    },
    [steps]
  );

  const undo = useCallback(() => {
    const entry = undoStack.current.shift();
    if (!entry) return null;
    setSteps(entry.steps);
    return { label: entry.label, steps: entry.steps };
  }, []);

  const clear = useCallback(() => {
    undoStack.current = [];
  }, []);

  const canUndo = undoStack.current.length > 0;

  return { steps, setSteps, push, undo, clear, canUndo };
}
