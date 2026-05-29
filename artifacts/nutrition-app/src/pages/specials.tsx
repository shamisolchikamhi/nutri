import { useState } from "react";
import { useListSpecials, useGetBestValueSpecials, useListRetailers } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tag, TrendingDown } from "lucide-react";

export default function SpecialsPage() {
  const [retailerId, setRetailerId] = useState("all");
  const [goalFit, setGoalFit] = useState("all");
  const [tab, setTab] = useState<"all" | "best-value">("all");

  const { data: retailers } = useListRetailers();
  const { data: specials, isLoading } = useListSpecials(
    {
      retailerId: retailerId !== "all" ? parseInt(retailerId) : undefined,
      goalFit: goalFit !== "all" ? (goalFit as any) : undefined,
    },
    { query: { enabled: tab === "all" } as any }
  );
  const { data: bestValue, isLoading: bvLoading } = useGetBestValueSpecials({ query: { enabled: tab === "best-value" } as any });

  const displaySpecials = tab === "best-value" ? bestValue : specials;
  const loading = tab === "best-value" ? bvLoading : isLoading;

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
      ) : (displaySpecials ?? []).length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Tag className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>No specials found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(displaySpecials ?? []).map((special) => (
            <Card key={special.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="flex gap-0">
                  <img
                    src={special.imageUrl}
                    alt={special.productName}
                    className="w-28 h-28 object-cover flex-shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1542838132-92c53300491e?w=200"; }}
                  />
                  <div className="p-3 flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-sm leading-tight line-clamp-2">{special.productName}</p>
                      <Badge className="flex-shrink-0 bg-red-500 text-white text-xs">
                        -{special.savingsPercent}%
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{special.retailerName}</p>
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className="text-xl font-bold text-primary">${special.specialPriceAud}</span>
                      <span className="text-sm text-muted-foreground line-through">${special.regularPriceAud}</span>
                    </div>
                    <p className="text-xs text-emerald-600 font-medium">Save ${special.savingsAud}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {special.goalFit.slice(0, 2).map((g) => (
                        <Badge key={g} variant="outline" className="text-xs py-0 capitalize">{g.replace("_", " ")}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
