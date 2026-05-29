import { useRoute, useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useGetRecipe,
  saveRecipe,
  unsaveRecipe,
  getListSavedRecipesQueryKey,
  getGetRecipeQueryKey,
  createBasketFromRecipes,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Bookmark, BookmarkCheck, Clock, Flame, ChefHat, ShoppingCart, ArrowLeft, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function RecipeDetailPage() {
  const [, params] = useRoute("/recipes/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const id = parseInt(params?.id ?? "0");

  const { data: recipe, isLoading } = useGetRecipe(id);

  const saveMutation = useMutation({
    mutationFn: () => saveRecipe({ itemId: id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getListSavedRecipesQueryKey() });
      qc.invalidateQueries({ queryKey: getGetRecipeQueryKey(id) });
    },
  });

  const unsaveMutation = useMutation({
    mutationFn: () => unsaveRecipe(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getListSavedRecipesQueryKey() });
      qc.invalidateQueries({ queryKey: getGetRecipeQueryKey(id) });
    },
  });

  const basketMutation = useMutation({
    mutationFn: () => createBasketFromRecipes({ recipeIds: [id], name: `${recipe?.name} Shopping`, mode: "cheapest" }),
    onSuccess: (basket) => {
      toast({ title: "Basket created!", description: `${basket.items.length} items added` });
      setLocation(`/basket/${basket.id}`);
    },
  });

  if (isLoading) return (
    <div className="space-y-4">
      <Skeleton className="h-56 rounded-xl" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-32" />
    </div>
  );

  if (!recipe) return (
    <div className="text-center py-12 text-muted-foreground">
      <ChefHat className="h-10 w-10 mx-auto mb-2 opacity-30" />
      <p>Recipe not found</p>
      <Button variant="ghost" onClick={() => setLocation("/recipes")}>Back to recipes</Button>
    </div>
  );

  const totalTime = (recipe.prepTimeMin ?? 0) + (recipe.cookTimeMin ?? 0);

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" onClick={() => setLocation("/recipes")} className="-ml-2">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back
      </Button>

      {/* Hero Image */}
      <div className="relative rounded-2xl overflow-hidden">
        <img
          src={recipe.imageUrl}
          alt={recipe.name}
          className="w-full h-56 object-cover"
          onError={(e) => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=600"; }}
        />
        <button
          className="absolute top-3 right-3 h-9 w-9 bg-background/80 backdrop-blur rounded-full flex items-center justify-center"
          onClick={() => recipe.isSaved ? unsaveMutation.mutate() : saveMutation.mutate()}
        >
          {recipe.isSaved
            ? <BookmarkCheck className="h-5 w-5 text-primary" />
            : <Bookmark className="h-5 w-5" />
          }
        </button>
      </div>

      {/* Title & Tags */}
      <div>
        <h1 className="text-2xl font-bold mb-2">{recipe.name}</h1>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {recipe.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="capitalize">{tag.replace("_", " ")}</Badge>
          ))}
        </div>
        <p className="text-muted-foreground text-sm">{recipe.description}</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { icon: <Clock className="h-4 w-4" />, label: "Time", val: `${totalTime}m` },
          { icon: <Flame className="h-4 w-4" />, label: "Calories", val: `${recipe.caloriesPerServing}` },
          { icon: <Users className="h-4 w-4" />, label: "Serves", val: String(recipe.servings) },
          { icon: <span className="text-sm">$</span>, label: "Cost", val: `$${recipe.estimatedCost}` },
        ].map((s) => (
          <div key={s.label} className="bg-muted/50 rounded-xl p-3 text-center">
            <div className="flex justify-center text-muted-foreground mb-1">{s.icon}</div>
            <p className="text-base font-bold">{s.val}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Macros */}
      <Card>
        <CardContent className="p-4">
          <h2 className="font-semibold mb-3">Nutrition per serving</h2>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-2xl font-bold text-emerald-600">{recipe.proteinPerServingG}g</p>
              <p className="text-xs text-muted-foreground">Protein</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-500">{recipe.carbsPerServingG}g</p>
              <p className="text-xs text-muted-foreground">Carbs</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-500">{recipe.fatPerServingG}g</p>
              <p className="text-xs text-muted-foreground">Fat</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ingredients */}
      {recipe.ingredients && recipe.ingredients.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h2 className="font-semibold mb-3">Ingredients</h2>
            <div className="space-y-2">
              {recipe.ingredients.map((ing, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-b-0">
                  <span className="text-sm">{ing.name}</span>
                  <div className="text-right">
                    <span className="text-sm font-medium">{ing.quantity} {ing.unit}</span>
                    <span className="text-xs text-muted-foreground ml-2">${ing.estimatedCost}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      {recipe.instructions && recipe.instructions.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h2 className="font-semibold mb-3">Instructions</h2>
            <ol className="space-y-3">
              {recipe.instructions.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                  <p className="text-sm text-muted-foreground">{step}</p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {/* Add to Basket */}
      <div className="sticky bottom-4">
        <Button
          className="w-full h-12 text-base shadow-lg"
          onClick={() => basketMutation.mutate()}
          disabled={basketMutation.isPending}
        >
          <ShoppingCart className="h-5 w-5 mr-2" />
          {basketMutation.isPending ? "Creating basket..." : "Add Ingredients to Basket"}
        </Button>
      </div>
    </div>
  );
}
