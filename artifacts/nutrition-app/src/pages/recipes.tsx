import { useState } from "react";
import { useLocation } from "wouter";
import { useAppMutation } from "@/hooks/use-app-mutation";
import {
  useListRecipes,
  useGetRecommendedRecipes,
  saveRecipe,
  unsaveRecipe,
  getListSavedRecipesQueryKey,
  getListRecipesQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link2 } from "lucide-react";
import { PageEmpty, PageError } from "@/components/PageState";
import { RecipeCard } from "@/components/content/RecipeCard";
import { useUndoableAction } from "@/hooks/use-undoable-action";
import { SocialRecipesPanel } from "@/components/social-recipes/SocialRecipesPanel";

const GOALS = [
  { value: "all", label: "All Goals" },
  { value: "high_protein", label: "High Protein" },
  { value: "low_calorie", label: "Low Calorie" },
  { value: "fat_loss", label: "Fat Loss" },
  { value: "vegan", label: "Vegan" },
  { value: "budget", label: "Budget" },
];

const DIFFICULTY = [
  { value: "all", label: "Any Difficulty" },
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

const MEAL_CATEGORIES = [
  { value: "all", label: "All Meals" },
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch_dinner", label: "Lunch/Dinner" },
  { value: "snack", label: "Snack" },
];

export default function RecipesPage() {
  const scheduleUndoable = useUndoableAction();
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");
  const [goal, setGoal] = useState("all");
  const [difficulty, setDifficulty] = useState("all");
  const [mealCategory, setMealCategory] = useState("all");
  const [viewMode, setViewMode] = useState<"all" | "recommended" | "social">("all");

  const recipesQuery = useListRecipes(
    {
      query: query || undefined,
      goal: goal !== "all" ? (goal as any) : undefined,
      difficulty: difficulty !== "all" ? (difficulty as any) : undefined,
    },
    { query: { enabled: viewMode === "all" } as any }
  );
  const recommendedQuery = useGetRecommendedRecipes({ query: { enabled: viewMode === "recommended" } as any });
  const { data: recipes, isLoading } = recipesQuery;
  const { data: recommended, isLoading: recLoading } = recommendedQuery;

  const displayRecipes = (viewMode === "recommended" ? recommended : recipes)?.filter((recipe) => {
    if (mealCategory === "all") return true;
    return ((recipe as any).mealType ?? "lunch_dinner") === mealCategory || recipe.tags?.includes(mealCategory);
  });
  const loading = viewMode === "recommended" ? recLoading : isLoading;
  const activeQuery = viewMode === "recommended" ? recommendedQuery : recipesQuery;

  const saveMutation = useAppMutation({
    operation: "Save recipe",
    reference: "WRITE-RECIPE-SAVE",
    successMessage: "The recipe was added to Saved.",
    invalidate: [getListSavedRecipesQueryKey(), getListRecipesQueryKey()],
    mutationFn: (recipeId: number) => saveRecipe({ itemId: recipeId }),
  });

  const unsaveMutation = useAppMutation({
    operation: "Remove saved recipe",
    reference: "WRITE-RECIPE-UNSAVE",
    successMessage: "The recipe was removed from Saved.",
    invalidate: [getListSavedRecipesQueryKey(), getListRecipesQueryKey()],
    mutationFn: (recipeId: number) => unsaveRecipe(recipeId),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Recipes</h1>
        <p className="text-muted-foreground text-sm">Discover budget-friendly, goal-aligned meals</p>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <Input
          placeholder="Search recipes..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full"
        />
        <div className="flex gap-2">
          <Select value={goal} onValueChange={setGoal}>
            <SelectTrigger className="flex-1"><SelectValue placeholder="Goal" /></SelectTrigger>
            <SelectContent>
              {GOALS.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={difficulty} onValueChange={setDifficulty}>
            <SelectTrigger className="flex-1"><SelectValue placeholder="Difficulty" /></SelectTrigger>
            <SelectContent>
              {DIFFICULTY.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={viewMode === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("all")}
          >All Recipes</Button>
          <Button
            variant={viewMode === "recommended" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("recommended")}
          >Recommended</Button>
          <Button
            variant={viewMode === "social" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("social")}
          >
            <Link2 className="h-3.5 w-3.5 mr-1" /> Social
          </Button>
        </div>
        {viewMode !== "social" && (
          <div className="flex gap-2 flex-wrap">
            {MEAL_CATEGORIES.map((category) => (
              <Button
                key={category.value}
                variant={mealCategory === category.value ? "default" : "outline"}
                size="sm"
                onClick={() => setMealCategory(category.value)}
              >
                {category.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Recipe Grid */}
      {viewMode === "social" ? (
        <SocialRecipesPanel />
      ) : loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      ) : activeQuery.isError ? (
        <PageError reference="DATA-RECIPES" onRetry={() => void activeQuery.refetch()} isRetrying={activeQuery.isFetching} />
      ) : (displayRecipes ?? []).length === 0 ? (
        <PageEmpty title="No recipes match" description="Clear the search and meal filters to return to all recipes." action={<Button onClick={() => { setQuery(""); setGoal("all"); setDifficulty("all"); setMealCategory("all"); setViewMode("all"); }}>Clear filters</Button>} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(displayRecipes ?? []).map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={{ ...recipe, mealTypeLabel: (recipe as any).mealTypeLabel }}
              onOpen={() => setLocation(`/recipes/${recipe.id}`)}
              onSave={() => saveMutation.mutate(recipe.id)}
              onRemove={() => scheduleUndoable({ label: "Saved recipe removal", onCommit: () => unsaveMutation.mutate(recipe.id) })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
