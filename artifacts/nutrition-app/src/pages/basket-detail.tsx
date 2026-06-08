import { useRoute, useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useGetBasket,
  useGetShoppingList,
  useListProducts,
  addBasketItem,
  updateBasketItem,
  deleteBasketItem,
  getGetBasketQueryKey,
  getGetShoppingListQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExternalLink, Trash2, Plus, Minus, ArrowLeft, ShoppingBag, Tag } from "lucide-react";
import { useState } from "react";
import { formatMoney } from "@/lib/market";

export default function BasketDetailPage() {
  const [, params] = useRoute("/basket/:id");
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const id = parseInt(params?.id ?? "0");
  const [view, setView] = useState<"basket" | "shopping-list">("basket");
  const [addingProductId, setAddingProductId] = useState<number | null>(null);

  const { data: basket, isLoading } = useGetBasket(id);
  const { data: shoppingList } = useGetShoppingList(id, { query: { enabled: view === "shopping-list" } as any });
  const { data: products } = useListProducts();

  const inv = () => {
    qc.invalidateQueries({ queryKey: getGetBasketQueryKey(id) });
    qc.invalidateQueries({ queryKey: getGetShoppingListQueryKey(id) });
  };

  const addMutation = useMutation({
    mutationFn: (productId: number) =>
      addBasketItem(id, { productId, quantity: 1, unit: "pack" }),
    onSuccess: () => { inv(); setAddingProductId(null); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ itemId, productId, quantity }: { itemId: number; productId: number; quantity: number }) =>
      updateBasketItem(id, itemId, { productId, quantity }),
    onSuccess: inv,
  });

  const deleteMutation = useMutation({
    mutationFn: (itemId: number) => deleteBasketItem(id, itemId),
    onSuccess: inv,
  });

  if (isLoading) return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-32" />
      {[1,2,3].map(i => <Skeleton key={i} className="h-16" />)}
    </div>
  );

  if (!basket) return (
    <div className="text-center py-12">
      <p className="text-muted-foreground">Basket not found</p>
      <Button variant="ghost" onClick={() => setLocation("/basket")}>Back to baskets</Button>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/basket")} className="-ml-2">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">{basket.name}</h1>
          <p className="text-muted-foreground text-sm capitalize">{basket.mode.replace("_", " ")} mode</p>
        </div>
      </div>

      {/* Summary */}
      <Card className="bg-gradient-to-r from-primary to-emerald-400 text-primary-foreground">
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-3xl font-bold">{formatMoney(basket.totalCost)}</p>
              <p className="text-primary-foreground/80 text-xs">Total Cost</p>
            </div>
            <div>
              <p className="text-3xl font-bold">{basket.items.length}</p>
              <p className="text-primary-foreground/80 text-xs">Items</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-amber-200">{formatMoney(basket.savingsFromSpecials)}</p>
              <p className="text-primary-foreground/80 text-xs">Saved</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Nutrition Summary */}
      <Card>
        <CardContent className="p-4">
          <p className="text-sm font-medium mb-3">Estimated Nutrition</p>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <p className="font-bold">{basket.totalCalories}</p>
              <p className="text-xs text-muted-foreground">kcal</p>
            </div>
            <div>
              <p className="font-bold text-emerald-600">{basket.totalProteinG}g</p>
              <p className="text-xs text-muted-foreground">protein</p>
            </div>
            <div>
              <p className="font-bold text-amber-500">{basket.totalCarbsG}g</p>
              <p className="text-xs text-muted-foreground">carbs</p>
            </div>
            <div>
              <p className="font-bold text-purple-500">{basket.totalFatG}g</p>
              <p className="text-xs text-muted-foreground">fat</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* View Toggle */}
      <div className="flex gap-2">
        <Button variant={view === "basket" ? "default" : "outline"} size="sm" onClick={() => setView("basket")}>
          <ShoppingBag className="h-4 w-4 mr-1" /> Items
        </Button>
        <Button variant={view === "shopping-list" ? "default" : "outline"} size="sm" onClick={() => setView("shopping-list")}>
          <Tag className="h-4 w-4 mr-1" /> Shopping List
        </Button>
      </div>

      {view === "basket" && (
        <>
          {/* Add Product */}
          <Card>
            <CardContent className="p-3">
              <Select onValueChange={(v) => { setAddingProductId(parseInt(v)); addMutation.mutate(parseInt(v)); }}>
                <SelectTrigger>
                  <SelectValue placeholder="+ Add product to basket..." />
                </SelectTrigger>
                <SelectContent>
                  {(products ?? []).map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name} - {formatMoney(p.priceAud)} ({p.retailerName})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Items */}
          <div className="space-y-2">
            {basket.items.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-xl">
                <ShoppingBag className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>No items yet. Add products above or create from a recipe.</p>
              </div>
            ) : (
              basket.items.map((item) => (
                <Card key={item.id}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm leading-tight">{item.productName}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{item.retailerName}</span>
                        <span>·</span>
                        {(item as any).packSize && (
                          <>
                            <span>{(item as any).packSize}{(item as any).packUnit} pack</span>
                            <span>·</span>
                          </>
                        )}
                        <span className="font-medium text-primary">{formatMoney(item.totalCost)}</span>
                        {item.isOnSpecial && <Badge variant="secondary" className="py-0 text-xs">SPECIAL</Badge>}
                      </div>
                      {(item as any).productUrl && (
                        <a
                          href={(item as any).productUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                          Open at Woolworths
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        className="h-7 w-7 rounded-full border flex items-center justify-center hover:bg-muted transition-colors"
                        onClick={() => item.quantity > 1 ? updateMutation.mutate({ itemId: item.id, productId: item.productId, quantity: item.quantity - 1 }) : deleteMutation.mutate(item.id)}
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-14 text-center text-sm font-medium">{item.quantity} pack{item.quantity === 1 ? "" : "s"}</span>
                      <button
                        className="h-7 w-7 rounded-full border flex items-center justify-center hover:bg-muted transition-colors"
                        onClick={() => updateMutation.mutate({ itemId: item.id, productId: item.productId, quantity: item.quantity + 1 })}
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <button
                      className="h-7 w-7 rounded-lg hover:bg-destructive/10 hover:text-destructive flex items-center justify-center transition-colors"
                      onClick={() => deleteMutation.mutate(item.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </>
      )}

      {view === "shopping-list" && shoppingList && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">Grouped by category</p>
            <p className="text-sm font-semibold">Total: {formatMoney(shoppingList.totalCost)}</p>
          </div>
          {shoppingList.groups.map((group) => (
            <div key={group.groupLabel}>
              <h3 className="font-semibold text-sm capitalize mb-2">{group.groupLabel}</h3>
              <div className="space-y-1.5">
                {group.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-2.5 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 rounded border border-muted-foreground/30" />
                      {(item as any).productUrl ? (
                        <a
                          href={(item as any).productUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-sm hover:text-primary hover:underline"
                        >
                          {item.productName}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-sm">{item.productName}</span>
                      )}
                      <span className="text-xs text-muted-foreground">×{item.quantity} pack{item.quantity === 1 ? "" : "s"}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{formatMoney(item.totalCost)}</p>
                      <p className="text-xs text-muted-foreground">{item.retailerName}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {shoppingList.savingsFromSpecials > 0 && (
            <Card className="bg-emerald-50 border-emerald-200">
              <CardContent className="p-3 text-sm text-emerald-800">
                Saving <strong>{formatMoney(shoppingList.savingsFromSpecials)}</strong> from specials this week!
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
