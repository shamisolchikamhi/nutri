import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart2, ExternalLink } from "lucide-react";
import { ContentImage } from "./ContentImage";
import { SaveControl } from "./SaveControl";
import { formatMoney } from "@/lib/market";
import { calculateValueScore } from "@/lib/value-score";

export type ProductCardData = {
  id: number;
  name: string;
  imageUrl?: string | null;
  retailerName?: string;
  price: number;
  regularPrice?: number | null;
  isOnSpecial?: boolean;
  calories?: number | null;
  proteinG?: number | null;
  fiberG?: number | null;
  packSize?: number | null;
  packUnit?: string | null;
  category?: string | null;
  savings?: number;
  savingsPercent?: number;
  tags?: string[];
  validFrom?: string | null;
  validUntil?: string | null;
  promotionType?: string;
  multibuyQuantity?: number | null;
  multibuyPrice?: number | null;
  loyaltyRequired?: boolean;
  stockStatus?: string;
  region?: string | null;
  store?: string | null;
  channel?: string;
  terms?: string | null;
  sourceUrl?: string | null;
  lastVerifiedAt?: string | null;
};

type ProductCardProps = {
  product: ProductCardData;
  variant?: "grid" | "compact" | "special";
  saved?: boolean;
  onRemove?: () => void;
  onCompare?: () => void;
  action?: ReactNode;
};

function formatDate(value?: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
}

function formatVerified(value?: string | null) {
  if (!value) return "Verification pending";
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "Verification pending";

  const diffMs = Date.now() - timestamp;
  if (diffMs < 0) return "Verified just now";
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return "Verified under 1 hour ago";
  if (diffHours < 48) return `Verified ${diffHours} hours ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `Verified ${diffDays} days ago`;
}

function promotionConditionLabels(product: ProductCardData) {
  const labels: string[] = [];
  const from = formatDate(product.validFrom);
  const until = formatDate(product.validUntil);
  if (from && until) labels.push(`Valid ${from} to ${until}`);
  else if (until) labels.push(`Valid until ${until}`);
  else if (from) labels.push(`Valid from ${from}`);

  const scope = [product.region, product.store].filter(Boolean).join(" / ");
  if (scope) labels.push(scope);
  if (product.channel) labels.push(product.channel.replace("_", " "));
  if (product.loyaltyRequired) labels.push("Loyalty card required");
  if (product.multibuyQuantity && product.multibuyPrice) labels.push(`${product.multibuyQuantity} for ${formatMoney(product.multibuyPrice)}`);
  if (product.stockStatus && product.stockStatus !== "in_stock") labels.push(`Stock: ${product.stockStatus.replace("_", " ")}`);
  if (product.terms) labels.push(product.terms);
  return labels;
}

export function ProductCard({ product, variant = "grid", saved, onRemove, onCompare, action }: ProductCardProps) {
  const valueScore = calculateValueScore(product);

  if (variant === "special") {
    const conditionLabels = promotionConditionLabels(product);

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
            <p className="text-xs text-muted-foreground">{formatVerified(product.lastVerifiedAt)}</p>
            {product.savings != null && <p className="text-xs font-medium text-emerald-600">Save {formatMoney(product.savings)}</p>}
            <ValueScoreBlock valueScore={valueScore} compact />
            <div className="mt-2 flex flex-wrap gap-1">{(product.tags ?? []).slice(0, 2).map((tag) => <Badge key={tag} variant="outline" className="py-0 text-xs capitalize">{tag.replace("_", " ")}</Badge>)}</div>
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              {conditionLabels.map((label) => <p key={label}>{label}</p>)}
              {product.sourceUrl && (
                <a href={product.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                  Source <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
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
        <p className="mb-2 text-xs text-muted-foreground">{formatVerified(product.lastVerifiedAt)}</p>
        {(product.region || product.store || product.channel || product.stockStatus) && (
          <p className="mb-2 text-xs text-muted-foreground">
            {[product.region, product.store, product.channel, product.stockStatus && product.stockStatus !== "in_stock" ? `Stock: ${product.stockStatus.replace("_", " ")}` : null].filter(Boolean).join(" / ")}
          </p>
        )}
        {product.proteinG != null && <div className="flex justify-between text-xs"><span>Protein</span><span className="font-medium text-emerald-600">{product.proteinG}g/100g</span></div>}
        {product.calories != null && <div className="flex justify-between text-xs text-muted-foreground"><span>Calories</span><span>{product.calories} kcal</span></div>}
        <ValueScoreBlock valueScore={valueScore} />
        {product.sourceUrl && (
          <a href={product.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline">
            Source <ExternalLink className="h-3 w-3" />
          </a>
        )}
        {onCompare && <Button variant="outline" size="sm" className="mt-2 h-7 w-full text-xs" onClick={onCompare}><BarChart2 className="mr-1 h-3 w-3" /> Compare</Button>}
        {action}
      </CardContent>
    </Card>
  );
}

function ValueScoreBlock({ valueScore, compact = false }: { valueScore: ReturnType<typeof calculateValueScore>; compact?: boolean }) {
  return (
    <details className={compact ? "mt-2 rounded-lg bg-muted/50 px-2 py-1" : "mt-2 rounded-lg bg-muted/50 p-2"}>
      <summary className="cursor-pointer text-xs font-medium">
        Value score {valueScore.score}/100
      </summary>
      <div className="mt-1 space-y-1 text-xs text-muted-foreground">
        {valueScore.breakdown.map((item) => (
          <div key={item.label} className="flex justify-between gap-2">
            <span>{item.label}: {item.detail}</span>
            <span className="font-medium">{item.points}</span>
          </div>
        ))}
      </div>
    </details>
  );
}
