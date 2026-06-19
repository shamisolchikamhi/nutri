import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";

type BasketActionProps = {
  onClick: () => void;
  disabled?: boolean;
  pending?: boolean;
  label?: string;
  className?: string;
};

export function BasketAction({ onClick, disabled, pending, label = "Create basket", className }: BasketActionProps) {
  return (
    <Button size="sm" className={className} onClick={onClick} disabled={disabled || pending}>
      <ShoppingCart className="mr-1 h-3.5 w-3.5" /> {pending ? "Creating..." : label}
    </Button>
  );
}
