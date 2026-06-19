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
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Bookmark, ChefHat } from "lucide-react";
import { useState } from "react";
import { PageEmpty, PageError } from "@/components/PageState";
import { useUndoableAction } from "@/hooks/use-undoable-action";
import { RecipeCard } from "@/components/content/RecipeCard";
import { ProductCard } from "@/components/content/ProductCard";

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
                <RecipeCard
                  key={recipe.id}
                  variant="compact"
                  recipe={recipe}
                  onOpen={() => setLocation(`/recipes/${recipe.id}`)}
                  onRemove={() => scheduleUndoable({ label: "Saved recipe removal", onCommit: () => unsaveRecipeMutation.mutate(recipe.id) })}
                />
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
                <ProductCard
                  key={snack.productId}
                  variant="compact"
                  saved
                  product={{ id: snack.productId, name: snack.name, imageUrl: snack.imageUrl, retailerName: snack.retailerName, price: snack.priceAud, isOnSpecial: snack.isOnSpecial, calories: snack.caloriesPerServing }}
                  onRemove={() => scheduleUndoable({ label: "Saved snack removal", onCommit: () => unsaveSnackMutation.mutate(snack.productId) })}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
