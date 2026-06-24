import { useState } from "react";
import { useListProducts, useListRetailers, useCompareProduct } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Tag } from "lucide-react";
import { formatMoney } from "@/lib/market";
import { PageEmpty, PageError } from "@/components/PageState";
import { ProductCard } from "@/components/content/ProductCard";

const CATEGORIES = [
  { value: "all", label: "All Categories" },
  { value: "protein", label: "Protein" },
  { value: "dairy", label: "Dairy" },
  { value: "grains", label: "Grains" },
  { value: "fruit_veg", label: "Fruit & Veg" },
  { value: "snacks", label: "Snacks" },
  { value: "pantry", label: "Pantry" },
];

export default function ProductsPage() {
  const [query, setQuery] = useState("");
  const [retailerId, setRetailerId] = useState("all");
  const [category, setCategory] = useState("all");
  const [onSpecial, setOnSpecial] = useState(false);
  const [compareId, setCompareId] = useState<number | null>(null);

  const retailersQuery = useListRetailers();
  const productsQuery = useListProducts({
    query: query || undefined,
    retailerId: retailerId !== "all" ? parseInt(retailerId) : undefined,
    category: category !== "all" ? category : undefined,
    onSpecial: onSpecial || undefined,
  });
  const { data: retailers } = retailersQuery;
  const { data: products, isLoading } = productsQuery;

  const { data: compareData } = useCompareProduct(compareId!, { query: { enabled: !!compareId } as any });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Search className="h-6 w-6 text-primary" /> Products
        </h1>
        <p className="text-muted-foreground text-sm">Compare nutrition and recently observed prices across all retailers</p>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <Input placeholder="Search products..." value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="flex gap-2 flex-wrap">
          <Select value={retailerId} onValueChange={setRetailerId}>
            <SelectTrigger className="flex-1 min-w-28">
              <SelectValue placeholder="Retailer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Retailers</SelectItem>
              {(retailers ?? []).map(r => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="flex-1 min-w-28">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button
            variant={onSpecial ? "default" : "outline"}
            size="sm"
            onClick={() => setOnSpecial(!onSpecial)}
            className="flex-shrink-0"
          >
            <Tag className="h-3.5 w-3.5 mr-1" /> Specials
          </Button>
        </div>
      </div>

      {/* Products */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      ) : productsQuery.isError || retailersQuery.isError ? (
        <PageError reference="DATA-PRODUCTS" onRetry={() => void (productsQuery.isError ? productsQuery.refetch() : retailersQuery.refetch())} isRetrying={productsQuery.isFetching || retailersQuery.isFetching} />
      ) : (products ?? []).length === 0 ? (
        <PageEmpty title="No products match" description="Clear the search and filters to return to the full catalogue." action={<Button onClick={() => { setQuery(""); setRetailerId("all"); setCategory("all"); setOnSpecial(false); }}>Clear filters</Button>} />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {(products ?? []).map((product) => (
            <ProductCard
              key={product.id}
              product={{
                id: product.id,
                name: product.name,
                imageUrl: product.imageUrl,
                retailerName: product.retailerName,
                price: product.priceAud,
                regularPrice: product.regularPriceAud,
                isOnSpecial: product.isOnSpecial,
                calories: product.caloriesPer100g,
                proteinG: product.proteinPer100g,
                region: product.region,
                store: product.store,
                channel: product.channel,
                stockStatus: product.stockStatus,
                sourceUrl: product.canonicalSourceUrl,
                lastVerifiedAt: product.lastVerifiedAt,
              }}
              onCompare={() => setCompareId(product.id)}
            />
          ))}
        </div>
      )}

      {/* Compare Dialog */}
      <Dialog open={!!compareId} onOpenChange={(open) => !open && setCompareId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Price Comparison</DialogTitle>
          </DialogHeader>
          {compareData && compareData.length > 0 ? (
            <div className="space-y-2">
              {compareData.map((item, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-xl border-2 ${item.isCheapest ? "border-primary bg-primary/5" : item.isBestValue ? "border-amber-400 bg-amber-50" : "border-border"}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{(item.product as any).productName ?? item.product.name}</p>
                      <p className="text-xs text-muted-foreground">{item.product.retailerName}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatMoney(item.product.priceAud)}</p>
                      <p className="text-xs text-muted-foreground">{formatMoney(item.pricePerUnit)}/unit</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-1">
                    {item.isCheapest && <Badge className="text-xs py-0">Cheapest</Badge>}
                    {item.isBestValue && <Badge variant="secondary" className="text-xs py-0 bg-amber-100 text-amber-800">Best Value</Badge>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">No comparison data available</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
