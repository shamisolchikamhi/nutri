import { Bookmark, BookmarkCheck, BookmarkX } from "lucide-react";
import { ConfirmAction } from "@/components/ConfirmAction";
import { cn } from "@/lib/utils";

type SaveControlProps = {
  name: string;
  saved: boolean;
  onSave?: () => void;
  onRemove?: () => void;
  appearance?: "overlay" | "inline";
};

export function SaveControl({ name, saved, onSave, onRemove, appearance = "overlay" }: SaveControlProps) {
  const className = cn(
    "flex flex-shrink-0 items-center justify-center text-muted-foreground transition-colors",
    appearance === "overlay"
      ? "absolute right-2 top-2 h-8 w-8 rounded-full bg-background/80 backdrop-blur hover:bg-background"
      : "ml-2 hover:text-destructive",
  );
  const button = (
    <button
      type="button"
      aria-label={saved ? `Remove ${name} from saved` : `Save ${name}`}
      className={className}
      onClick={(event) => {
        event.stopPropagation();
        if (!saved) onSave?.();
      }}
    >
      {saved ? appearance === "inline" ? <BookmarkX className="h-4 w-4" /> : <BookmarkCheck className="h-4 w-4 text-primary" /> : <Bookmark className="h-4 w-4" />}
    </button>
  );

  if (!saved) return button;
  return (
    <ConfirmAction title={`Remove ${name} from Saved?`} description="You can save this item again later." onConfirm={() => onRemove?.()}>
      {button}
    </ConfirmAction>
  );
}
