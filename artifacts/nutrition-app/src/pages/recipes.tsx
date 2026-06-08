import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bookmark, BookmarkCheck, Clock, Flame, ChefHat, DollarSign, Link2, ShoppingCart, ExternalLink } from "lucide-react";
import { formatMoney } from "@/lib/market";

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

type SocialRecipe = {
  id: number;
  platform: string;
  sourceUrl: string;
  creatorHandle: string | null;
  title: string;
  caption: string;
  marketCode: string;
  status: string;
  importedRecipeId: number | null;
  matchedCount: number;
  unmatchedIngredients: string[];
  recipe: {
    id: number;
    name: string;
    estimatedCost: number;
    caloriesPerServing: number;
    proteinPerServingG: number;
    servings: number;
  } | null;
};

async function readErrorMessage(response: Response) {
  const text = await response.text().catch(() => "");
  if (!text) return `Request failed with ${response.status}`;

  try {
    const body = JSON.parse(text) as { error?: unknown; message?: unknown };
    const message = typeof body.error === "string" ? body.error : typeof body.message === "string" ? body.message : "";
    if (message) return message;
  } catch {
    // Plain text or HTML proxy errors are handled below.
  }

  const plainText = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return plainText ? `Request failed with ${response.status}: ${plainText.slice(0, 220)}` : `Request failed with ${response.status}`;
}

async function apiJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return response.json() as Promise<T>;
}

export default function RecipesPage() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [goal, setGoal] = useState("all");
  const [difficulty, setDifficulty] = useState("all");
  const [viewMode, setViewMode] = useState<"all" | "recommended" | "social">("all");
  const [socialForm, setSocialForm] = useState({
    sourceUrl: "",
    platform: "auto",
    title: "",
    creatorHandle: "",
    ingredientsText: "",
    caption: "",
    servings: "2",
    marketCode: "ZA",
  });
  const [createBasketAfterImport, setCreateBasketAfterImport] = useState(true);

  const { data: recipes, isLoading } = useListRecipes(
    {
      query: query || undefined,
      goal: goal !== "all" ? (goal as any) : undefined,
      difficulty: difficulty !== "all" ? (difficulty as any) : undefined,
    },
    { query: { enabled: viewMode === "all" } as any }
  );
  const { data: recommended, isLoading: recLoading } = useGetRecommendedRecipes({ query: { enabled: viewMode === "recommended" } as any });
  const { data: socialRecipes, isLoading: socialLoading, refetch: refetchSocialRecipes } = useQuery({
    queryKey: ["social-recipes"],
    queryFn: () => apiJson<SocialRecipe[]>("/social-recipes"),
    enabled: viewMode === "social",
  });

  const displayRecipes = viewMode === "recommended" ? recommended : recipes;
  const loading = viewMode === "recommended" ? recLoading : isLoading;

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

  const importSocialMutation = useMutation({
    mutationFn: () =>
      apiJson<SocialRecipe>("/social-recipes", {
        method: "POST",
        body: JSON.stringify({
          ...socialForm,
          autoExtract: true,
          platform: socialForm.platform === "auto" ? undefined : socialForm.platform,
          servings: parseInt(socialForm.servings) || 2,
        }),
    }),
    onSuccess: async (created) => {
      setSocialForm({
        sourceUrl: "",
        platform: "auto",
        title: "",
        creatorHandle: "",
        ingredientsText: "",
        caption: "",
        servings: "2",
        marketCode: "ZA",
      });
      refetchSocialRecipes();
      qc.invalidateQueries({ queryKey: getListRecipesQueryKey() });
      if (createBasketAfterImport && created.matchedCount > 0) {
        try {
          const basket = await apiJson<{ basketId: number }>(`/social-recipes/${created.id}/basket`, {
            method: "POST",
            body: JSON.stringify({ mode: "cheapest" }),
          });
          setLocation(`/basket/${basket.basketId}`);
        } catch {
          refetchSocialRecipes();
        }
      }
    },
  });

  const basketMutation = useMutation({
    mutationFn: (socialRecipeId: number) =>
      apiJson<{ basketId: number; unmatchedIngredients: string[] }>(`/social-recipes/${socialRecipeId}/basket`, {
        method: "POST",
        body: JSON.stringify({ mode: "cheapest" }),
      }),
    onSuccess: (basket) => setLocation(`/basket/${basket.basketId}`),
  });

  const importedSocialRecipes = socialRecipes ?? [];
  const socialBusy = socialLoading;
  const updateSocialForm = (key: keyof typeof socialForm, value: string) =>
    setSocialForm((form) => ({ ...form, [key]: value }));

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
      </div>

      {/* Recipe Grid */}
      {viewMode === "social" ? (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div>
                <h2 className="font-semibold">Import social recipe</h2>
                <p className="text-sm text-muted-foreground">Paste a public recipe link. AI will extract the recipe when the post exposes enough public text.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1 md:col-span-2">
                  <Label>Post URL</Label>
                  <Input
                    placeholder="https://www.tiktok.com/@creator/video/..."
                    value={socialForm.sourceUrl}
                    onChange={(e) => updateSocialForm("sourceUrl", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Title</Label>
                  <Input
                    placeholder="High protein chicken bowl"
                    value={socialForm.title}
                    onChange={(e) => updateSocialForm("title", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Creator</Label>
                  <Input
                    placeholder="@creator"
                    value={socialForm.creatorHandle}
                    onChange={(e) => updateSocialForm("creatorHandle", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Platform</Label>
                  <Select value={socialForm.platform} onValueChange={(value) => updateSocialForm("platform", value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto detect</SelectItem>
                      <SelectItem value="tiktok">TikTok</SelectItem>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="facebook">Facebook</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Servings</Label>
                  <Input
                    type="number"
                    min="1"
                    value={socialForm.servings}
                    onChange={(e) => updateSocialForm("servings", e.target.value)}
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label>Ingredients</Label>
                  <Textarea
                    placeholder={"Optional hint if the post is hard to read:\n1 cup oats\n2 bananas\n200g yoghurt\n1 tbsp peanut butter"}
                    value={socialForm.ingredientsText}
                    onChange={(e) => updateSocialForm("ingredientsText", e.target.value)}
                    className="min-h-28"
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label>Caption or notes</Label>
                  <Textarea
                    placeholder="Optional caption, method, or notes from the post"
                    value={socialForm.caption}
                    onChange={(e) => updateSocialForm("caption", e.target.value)}
                    className="min-h-20"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={createBasketAfterImport}
                  onCheckedChange={(checked) => setCreateBasketAfterImport(checked === true)}
                />
                Create a grocery basket from matched local-store ingredients
              </label>
              {importSocialMutation.error && (
                <p className="text-sm text-destructive">
                  {(importSocialMutation.error as Error).message === "ingredientsText or caption is required"
                    ? "The API server needs to be restarted or redeployed to use URL-only AI extraction."
                    : (importSocialMutation.error as Error).message}
                </p>
              )}
              <Button
                onClick={() => importSocialMutation.mutate()}
                disabled={importSocialMutation.isPending || !socialForm.sourceUrl}
              >
                {importSocialMutation.isPending ? "Analyzing recipe..." : "Analyze URL and match local products"}
              </Button>
            </CardContent>
          </Card>

          {socialBusy ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1,2].map(i => <Skeleton key={i} className="h-44 rounded-xl" />)}
            </div>
          ) : importedSocialRecipes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Link2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>No social recipes imported yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {importedSocialRecipes.map((item) => (
                <Card key={item.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="secondary" className="capitalize">{item.platform}</Badge>
                          <Badge variant={item.status === "needs_review" ? "outline" : "default"} className="capitalize">
                            {item.status.replace("_", " ")}
                          </Badge>
                        </div>
                        <h3 className="font-semibold leading-tight">{item.title}</h3>
                        {item.creatorHandle && <p className="text-xs text-muted-foreground">{item.creatorHandle}</p>}
                      </div>
                      <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-sm">
                      <div className="rounded-lg bg-muted/50 p-2">
                        <p className="font-bold">{item.matchedCount}</p>
                        <p className="text-xs text-muted-foreground">matched</p>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-2">
                        <p className="font-bold">{item.unmatchedIngredients.length}</p>
                        <p className="text-xs text-muted-foreground">review</p>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-2">
                        <p className="font-bold">{item.recipe ? formatMoney(item.recipe.estimatedCost) : "-"}</p>
                        <p className="text-xs text-muted-foreground">basket est.</p>
                      </div>
                    </div>
                    {item.unmatchedIngredients.length > 0 && (
                      <p className="text-xs text-amber-700">
                        Needs match: {item.unmatchedIngredients.slice(0, 4).join(", ")}
                      </p>
                    )}
                    <div className="flex gap-2">
                      {item.importedRecipeId && (
                        <Button variant="outline" size="sm" onClick={() => setLocation(`/recipes/${item.importedRecipeId}`)}>
                          View recipe
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={() => basketMutation.mutate(item.id)}
                        disabled={basketMutation.isPending || item.matchedCount === 0}
                      >
                        <ShoppingCart className="h-3.5 w-3.5 mr-1" /> Create basket
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : loading ? (
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
                  <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />{formatMoney(recipe.estimatedCost)}</span>
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
