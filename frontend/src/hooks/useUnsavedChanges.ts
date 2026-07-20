import { useEffect, useRef } from "react";

export function useUnsavedChanges(isDirty: boolean) {
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (isDirtyRef.current) {
        // Some browsers require both preventDefault and returnValue to show a prompt.
        e.preventDefault();
        // eslint-disable-next-line no-param-reassign
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);
}
