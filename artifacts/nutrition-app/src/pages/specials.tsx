import { useState } from "react";
import { useListSpecials, useGetBestValueSpecials, useListRetailers } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tag, TrendingDown } from "lucide-react";
import { PageEmpty, PageError } from "@/components/PageState";
import { ProductCard } from "@/components/content/ProductCard";

export default function SpecialsPage() {
  const [retailerId, setRetailerId] = useState("all");
  const [goalFit, setGoalFit] = useState("all");
  const [tab, setTab] = useState<"all" | "best-value">("all");

  const retailersQuery = useListRetailers();
  const specialsQuery = useListSpecials(
    {
      retailerId: retailerId !== "all" ? parseInt(retailerId) : undefined,
      goalFit: goalFit !== "all" ? (goalFit as any) : undefined,
    },
    { query: { enabled: tab === "all" } as any }
  );
  const bestValueQuery = useGetBestValueSpecials({ query: { enabled: tab === "best-value" } as any });
  const { data: retailers } = retailersQuery;
  const { data: specials, isLoading } = specialsQuery;
  const { data: bestValue, isLoading: bvLoading } = bestValueQuery;

  const displaySpecials = tab === "best-value" ? bestValue : specials;
  const loading = tab === "best-value" ? bvLoading : isLoading;
  const activeQuery = tab === "best-value" ? bestValueQuery : specialsQuery;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Tag className="h-6 w-6 text-amber-500" /> Weekly Specials
        </h1>
        <p className="text-muted-foreground text-sm">Save money on your favourite health foods</p>
      </div>

      {/* Tabs & Filters */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <Button variant={tab === "all" ? "default" : "outline"} size="sm" onClick={() => setTab("all")}>All Specials</Button>
          <Button variant={tab === "best-value" ? "default" : "outline"} size="sm" onClick={() => setTab("best-value")}>
            <TrendingDown className="h-3.5 w-3.5 mr-1" /> Best Value
          </Button>
        </div>
        {tab === "all" && (
          <div className="flex gap-2">
            <Select value={retailerId} onValueChange={setRetailerId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="All Retailers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Retailers</SelectItem>
                {(retailers ?? []).map(r => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={goalFit} onValueChange={setGoalFit}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Any Goal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any Goal</SelectItem>
                <SelectItem value="high_protein">High Protein</SelectItem>
                <SelectItem value="fat_loss">Fat Loss</SelectItem>
                <SelectItem value="budget">Budget</SelectItem>
                <SelectItem value="vegan">Vegan</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : activeQuery.isError || retailersQuery.isError ? (
        <PageError reference="DATA-SPECIALS" onRetry={() => void (activeQuery.isError ? activeQuery.refetch() : retailersQuery.refetch())} isRetrying={activeQuery.isFetching || retailersQuery.isFetching} />
      ) : (displaySpecials ?? []).length === 0 ? (
        <PageEmpty title="No specials match" description="Clear the retailer and goal filters to see all current offers." action={<Button onClick={() => { setTab("all"); setRetailerId("all"); setGoalFit("all"); }}>Clear filters</Button>} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(displaySpecials ?? []).map((special) => (
            <ProductCard
              key={special.id}
              variant="special"
              product={{
                id: special.productId,
                name: special.productName,
                imageUrl: special.imageUrl,
                retailerName: special.retailerName,
                price: special.specialPriceAud,
                regularPrice: special.regularPriceAud,
                savings: special.savingsAud,
                savingsPercent: special.savingsPercent,
                tags: special.goalFit,
                validFrom: special.validFrom,
                validUntil: special.validUntil,
                promotionType: special.promotionType,
                multibuyQuantity: special.multibuyQuantity,
                multibuyPrice: special.multibuyPrice,
                loyaltyRequired: special.loyaltyRequired,
                stockStatus: special.stockStatus,
                region: special.region,
                store: special.store,
                channel: special.channel,
                terms: special.terms,
                sourceUrl: special.sourceUrl,
                lastVerifiedAt: special.lastVerifiedAt,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
