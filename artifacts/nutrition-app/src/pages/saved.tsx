import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useListSavedRecipes,
  useListSavedSnacks,
  unsaveRecipe,
  unsaveSnack,
  getListSavedRecipesQueryKey,
  getListSavedSnacksQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Bookmark, BookmarkX, Flame, Clock, DollarSign, ChefHat } from "lucide-react";
import { useState } from "react";
import { formatMoney } from "@/lib/market";

export default function SavedPage() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"recipes" | "snacks">("recipes");

  const { data: recipes, isLoading: recipesLoading } = useListSavedRecipes();
  const { data: snacks, isLoading: snacksLoading } = useListSavedSnacks();

  const unsaveRecipeMutation = useMutation({
    mutationFn: (id: number) => unsaveRecipe(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: getListSavedRecipesQueryKey() }),
  });

  const unsaveSnackMutation = useMutation({
    mutationFn: (productId: number) => unsaveSnack(productId),
    onSuccess: () => qc.invalidateQueries({ queryKey: getListSavedSnacksQueryKey() }),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bookmark className="h-6 w-6 text-primary" /> Saved
        </h1>
        <p className="text-muted-foreground text-sm">Your saved recipes and snacks</p>
      </div>

      <div className="flex gap-2">
        <Button variant={tab === "recipes" ? "default" : "outline"} size="sm" onClick={() => setTab("recipes")}>
          Recipes {recipes && recipes.length > 0 && `(${recipes.length})`}
        </Button>
        <Button variant={tab === "snacks" ? "default" : "outline"} size="sm" onClick={() => setTab("snacks")}>
          Snacks {snacks && snacks.length > 0 && `(${snacks.length})`}
        </Button>
      </div>

      {tab === "recipes" && (
        <>
          {recipesLoading ? (
            <div className="space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-32" />)}</div>
          ) : (recipes ?? []).length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <ChefHat className="h-10 w-10 mx-auto mb-2 opacity-20" />
              <p>No saved recipes yet</p>
              <Button variant="ghost" onClick={() => setLocation("/recipes")}>Browse recipes →</Button>
            </div>
          ) : (
            <div className="space-y-3">
              {(recipes ?? []).map((recipe) => (
                <Card key={recipe.id} className="overflow-hidden">
                  <CardContent className="p-0 flex">
                    <img
                      src={recipe.imageUrl}
                      alt={recipe.name}
                      className="w-24 h-24 object-cover flex-shrink-0"
                      onError={(e) => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=200"; }}
                    />
                    <div className="p-3 flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <h3 className="font-medium text-sm leading-tight line-clamp-2 cursor-pointer hover:text-primary" onClick={() => setLocation(`/recipes/${recipe.id}`)}>
                          {recipe.name}
                        </h3>
                        <button
                          className="ml-2 flex-shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => unsaveRecipeMutation.mutate(recipe.id)}
                        >
                          <BookmarkX className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Flame className="h-3 w-3" />{recipe.caloriesPerServing} kcal</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{(recipe.prepTimeMin ?? 0) + (recipe.cookTimeMin ?? 0)} min</span>
                        <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />{formatMoney(recipe.estimatedCost)}</span>
                      </div>
                      <div className="flex gap-1 mt-1.5">
                        {recipe.tags.slice(0, 2).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs py-0">{tag.replace("_", " ")}</Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "snacks" && (
        <>
          {snacksLoading ? (
            <div className="grid grid-cols-2 gap-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-48" />)}</div>
          ) : (snacks ?? []).length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Bookmark className="h-10 w-10 mx-auto mb-2 opacity-20" />
              <p>No saved snacks yet</p>
              <Button variant="ghost" onClick={() => setLocation("/products")}>Browse products →</Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {(snacks ?? []).map((snack) => (
                <Card key={snack.productId} className="overflow-hidden">
                  <div className="relative">
                    <img
                      src={snack.imageUrl}
                      alt={snack.name}
                      className="w-full h-28 object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1547592180-85f173990554?w=200"; }}
                    />
                    <button
                      className="absolute top-2 right-2 h-7 w-7 bg-background/80 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive"
                      onClick={() => unsaveSnackMutation.mutate(snack.productId)}
                    >
                      <BookmarkX className="h-3.5 w-3.5" />
                    </button>
                    {snack.isOnSpecial && <Badge className="absolute top-2 left-2 bg-red-500 text-white text-xs py-0">SPECIAL</Badge>}
                  </div>
                  <CardContent className="p-2.5">
                    <p className="font-medium text-xs leading-tight line-clamp-2">{snack.name}</p>
                    <p className="text-xs text-muted-foreground">{snack.retailerName}</p>
                    <div className="flex justify-between mt-1.5">
                      <span className="font-bold text-primary text-sm">{formatMoney(snack.priceAud)}</span>
                      <span className="text-xs text-muted-foreground">{snack.caloriesPerServing} kcal</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
