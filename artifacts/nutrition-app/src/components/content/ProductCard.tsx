import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart2 } from "lucide-react";
import { ContentImage } from "./ContentImage";
import { SaveControl } from "./SaveControl";
import { formatMoney } from "@/lib/market";

export type ProductCardData = {
  id: number;
  name: string;
  imageUrl?: string | null;
  retailerName?: string;
  price: number;
  regularPrice?: number | null;
  isOnSpecial?: boolean;
  calories?: number;
  proteinG?: number;
  savings?: number;
  savingsPercent?: number;
  tags?: string[];
};

type ProductCardProps = {
  product: ProductCardData;
  variant?: "grid" | "compact" | "special";
  saved?: boolean;
  onRemove?: () => void;
  onCompare?: () => void;
  action?: ReactNode;
};

export function ProductCard({ product, variant = "grid", saved, onRemove, onCompare, action }: ProductCardProps) {
  if (variant === "special") {
    return (
      <Card className="overflow-hidden">
        <CardContent className="flex p-0">
          <ContentImage src={product.imageUrl} kind="product" alt={product.name} className="h-28 w-28 flex-shrink-0" />
          <div className="min-w-0 flex-1 p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="line-clamp-2 text-sm font-medium leading-tight">{product.name}</p>
              {product.savingsPercent != null && <Badge className="flex-shrink-0 bg-red-500 text-xs text-white">-{product.savingsPercent}%</Badge>}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{product.retailerName}</p>
            <div className="mt-2 flex items-baseline gap-2"><span className="text-xl font-bold text-primary">{formatMoney(product.price)}</span>{product.regularPrice != null && <span className="text-sm text-muted-foreground line-through">{formatMoney(product.regularPrice)}</span>}</div>
            {product.savings != null && <p className="text-xs font-medium text-emerald-600">Save {formatMoney(product.savings)}</p>}
            <div className="mt-2 flex flex-wrap gap-1">{(product.tags ?? []).slice(0, 2).map((tag) => <Badge key={tag} variant="outline" className="py-0 text-xs capitalize">{tag.replace("_", " ")}</Badge>)}</div>
            {action}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="relative">
        <ContentImage src={product.imageUrl} kind={variant === "compact" ? "snack" : "product"} alt={product.name} className={variant === "compact" ? "h-28 w-full" : "h-32 w-full"} />
        {saved && onRemove && <SaveControl name={product.name} saved onRemove={onRemove} />}
        {product.isOnSpecial && <Badge className="absolute left-2 top-2 bg-red-500 py-0 text-xs text-white">SPECIAL</Badge>}
      </div>
      <CardContent className="p-3">
        <p className="mb-1 line-clamp-2 text-xs font-medium leading-tight">{product.name}</p>
        <p className="mb-2 text-xs text-muted-foreground">{product.retailerName}</p>
        <div className="mb-2 flex items-baseline justify-between"><span className="text-base font-bold text-primary">{formatMoney(product.price)}</span>{product.regularPrice != null && <span className="text-xs text-muted-foreground line-through">{formatMoney(product.regularPrice)}</span>}</div>
        {product.proteinG != null && <div className="flex justify-between text-xs"><span>Protein</span><span className="font-medium text-emerald-600">{product.proteinG}g/100g</span></div>}
        {product.calories != null && <div className="flex justify-between text-xs text-muted-foreground"><span>Calories</span><span>{product.calories} kcal</span></div>}
        {onCompare && <Button variant="outline" size="sm" className="mt-2 h-7 w-full text-xs" onClick={onCompare}><BarChart2 className="mr-1 h-3 w-3" /> Compare</Button>}
        {action}
      </CardContent>
    </Card>
  );
}
