import { useEffect, useRef } from "react";

import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";

const UNDO_DELAY_MS = 5_000;

export function useUndoableAction() {
  const { toast } = useToast();
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => () => {
    timers.current.forEach(clearTimeout);
    timers.current.clear();
  }, []);

  return ({ label, onCommit }: { label: string; onCommit: () => void }) => {
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      onCommit();
    }, UNDO_DELAY_MS);
    timers.current.add(timer);

    toast({
      title: `${label} scheduled`,
      description: "This action will be applied in 5 seconds.",
      duration: UNDO_DELAY_MS,
      action: (
        <ToastAction
          altText={`Undo ${label}`}
          onClick={() => {
            clearTimeout(timer);
            timers.current.delete(timer);
          }}
        >
          Undo
        </ToastAction>
      ),
    });
  };
}
