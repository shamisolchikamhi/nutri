import { useLocation } from "wouter";
import { useAppMutation } from "@/hooks/use-app-mutation";
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
import { PageEmpty, PageError } from "@/components/PageState";
import { ConfirmAction } from "@/components/ConfirmAction";
import { useUndoableAction } from "@/hooks/use-undoable-action";

export default function SavedPage() {
  const scheduleUndoable = useUndoableAction();
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<"recipes" | "snacks">("recipes");

  const recipesQuery = useListSavedRecipes();
  const snacksQuery = useListSavedSnacks();
  const { data: recipes, isLoading: recipesLoading } = recipesQuery;
  const { data: snacks, isLoading: snacksLoading } = snacksQuery;

  const unsaveRecipeMutation = useAppMutation({
    operation: "Remove saved recipe",
    reference: "WRITE-SAVED-RECIPE-REMOVE",
    successMessage: "The recipe was removed from Saved.",
    invalidate: [getListSavedRecipesQueryKey()],
    mutationFn: (id: number) => unsaveRecipe(id),
  });

  const unsaveSnackMutation = useAppMutation({
    operation: "Remove saved snack",
    reference: "WRITE-SAVED-SNACK-REMOVE",
    successMessage: "The snack was removed from Saved.",
    invalidate: [getListSavedSnacksQueryKey()],
    mutationFn: (productId: number) => unsaveSnack(productId),
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
          ) : recipesQuery.isError ? (
            <PageError reference="DATA-SAVED-RECIPES" onRetry={() => void recipesQuery.refetch()} isRetrying={recipesQuery.isFetching} />
          ) : (recipes ?? []).length === 0 ? (
            <PageEmpty title="No saved recipes yet" description="Save a recipe first to build your personal library." action={<Button onClick={() => setLocation("/recipes")}>Browse recipes</Button>} />
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
                        <ConfirmAction
                          title={`Remove ${recipe.name} from Saved?`}
                          description="You can save this recipe again later."
                          onConfirm={() => scheduleUndoable({ label: "Saved recipe removal", onCommit: () => unsaveRecipeMutation.mutate(recipe.id) })}
                        >
                          <button aria-label={`Remove ${recipe.name} from saved`} className="ml-2 flex-shrink-0 text-muted-foreground hover:text-destructive">
                            <BookmarkX className="h-4 w-4" />
                          </button>
                        </ConfirmAction>
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
          ) : snacksQuery.isError ? (
            <PageError reference="DATA-SAVED-SNACKS" onRetry={() => void snacksQuery.refetch()} isRetrying={snacksQuery.isFetching} />
          ) : (snacks ?? []).length === 0 ? (
            <PageEmpty title="No saved snacks yet" description="Save a product first to keep it in your snack library." action={<Button onClick={() => setLocation("/products")}>Browse products</Button>} />
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
                    <ConfirmAction
                      title={`Remove ${snack.name} from Saved?`}
                      description="You can save this snack again later."
                      onConfirm={() => scheduleUndoable({ label: "Saved snack removal", onCommit: () => unsaveSnackMutation.mutate(snack.productId) })}
                    >
                      <button aria-label={`Remove ${snack.name} from saved`} className="absolute top-2 right-2 h-7 w-7 bg-background/80 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive">
                        <BookmarkX className="h-3.5 w-3.5" />
                      </button>
                    </ConfirmAction>
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
