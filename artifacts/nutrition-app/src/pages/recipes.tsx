import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useListRecipes,
  useGetRecommendedRecipes,
  saveRecipe,
  unsaveRecipe,
  getListSavedRecipesQueryKey,
  getListRecipesQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bookmark, BookmarkCheck, Clock, Flame, ChefHat, DollarSign } from "lucide-react";

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

export default function RecipesPage() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [goal, setGoal] = useState("all");
  const [difficulty, setDifficulty] = useState("all");
  const [showRecommended, setShowRecommended] = useState(false);

  const { data: recipes, isLoading } = useListRecipes(
    {
      query: query || undefined,
      goal: goal !== "all" ? (goal as any) : undefined,
      difficulty: difficulty !== "all" ? (difficulty as any) : undefined,
    },
    { query: { enabled: !showRecommended } as any }
  );
  const { data: recommended, isLoading: recLoading } = useGetRecommendedRecipes({ query: { enabled: showRecommended } as any });

  const displayRecipes = showRecommended ? recommended : recipes;
  const loading = showRecommended ? recLoading : isLoading;

  const saveMutation = useMutation({
    mutationFn: (recipeId: number) => saveRecipe({ itemId: recipeId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getListSavedRecipesQueryKey() });
      qc.invalidateQueries({ queryKey: getListRecipesQueryKey() });
    },
  });

  const unsaveMutation = useMutation({
    mutationFn: (recipeId: number) => unsaveRecipe(recipeId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getListSavedRecipesQueryKey() });
      qc.invalidateQueries({ queryKey: getListRecipesQueryKey() });
    },
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
        <div className="flex gap-2">
          <Button
            variant={!showRecommended ? "default" : "outline"}
            size="sm"
            onClick={() => setShowRecommended(false)}
          >All Recipes</Button>
          <Button
            variant={showRecommended ? "default" : "outline"}
            size="sm"
            onClick={() => setShowRecommended(true)}
          >Recommended</Button>
        </div>
      </div>

      {/* Recipe Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      ) : (displayRecipes ?? []).length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ChefHat className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>No recipes found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(displayRecipes ?? []).map((recipe) => (
            <Card key={recipe.id} className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer" onClick={() => setLocation(`/recipes/${recipe.id}`)}>
              <div className="relative">
                <img
                  src={recipe.imageUrl}
                  alt={recipe.name}
                  className="w-full h-40 object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=400"; }}
                />
                <button
                  className="absolute top-2 right-2 h-8 w-8 bg-background/80 backdrop-blur rounded-full flex items-center justify-center hover:bg-background transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    recipe.isSaved ? unsaveMutation.mutate(recipe.id) : saveMutation.mutate(recipe.id);
                  }}
                >
                  {recipe.isSaved
                    ? <BookmarkCheck className="h-4 w-4 text-primary" />
                    : <Bookmark className="h-4 w-4 text-muted-foreground" />
                  }
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                  <h3 className="text-white font-semibold leading-tight text-sm">{recipe.name}</h3>
                </div>
              </div>
              <CardContent className="p-3 space-y-2">
                <div className="flex flex-wrap gap-1">
                  {recipe.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs py-0">{tag.replace("_", " ")}</Badge>
                  ))}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Flame className="h-3 w-3" />{recipe.caloriesPerServing} kcal</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{(recipe.prepTimeMin ?? 0) + (recipe.cookTimeMin ?? 0)} min</span>
                  <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />${recipe.estimatedCost}</span>
                  <Badge variant="outline" className="text-xs py-0 capitalize">{recipe.difficulty}</Badge>
                </div>
                <div className="flex gap-3 text-xs">
                  <span className="text-emerald-600 font-medium">P: {recipe.proteinPerServingG}g</span>
                  <span className="text-amber-600">C: {recipe.carbsPerServingG}g</span>
                  <span className="text-purple-600">F: {recipe.fatPerServingG}g</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
