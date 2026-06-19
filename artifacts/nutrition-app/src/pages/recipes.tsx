import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAppMutation } from "@/hooks/use-app-mutation";
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
import { Bookmark, BookmarkCheck, Clock, Flame, ChefHat, DollarSign, Link2, ShoppingCart, ExternalLink, Upload } from "lucide-react";
import { formatMoney } from "@/lib/market";
import { PageEmpty, PageError } from "@/components/PageState";
import { ConfirmAction } from "@/components/ConfirmAction";
import { useUndoableAction } from "@/hooks/use-undoable-action";

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
  if (!text && response.status === 502) {
    return "API server is unavailable. Restart the API server on port 5000, then refresh this page.";
  }
  if (!text) return `Request failed with ${response.status}`;

  try {
    const body = JSON.parse(text) as { error?: unknown; message?: unknown };
    const message = typeof body.error === "string" ? body.error : typeof body.message === "string" ? body.message : "";
    if (message) return message;
  } catch {
    // Plain text or HTML proxy errors are handled below.
  }

  const plainText = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (response.status === 502 && !plainText) {
    return "API server is unavailable. Restart the API server on port 5000, then refresh this page.";
  }
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

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

function resizeImageDataUrl(dataUrl: string, maxSize = 1024) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Could not process image"));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    image.onerror = () => reject(new Error("Could not load image"));
    image.src = dataUrl;
  });
}

async function extractVideoFrames(file: File) {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "metadata";

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Could not load video"));
      video.src = url;
    });

    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
    const latestTimestamp = Math.max(0, duration - 0.05);
    const timestamps = [0.08, 0.22, 0.38, 0.55, 0.72, 0.9].map((point) => Math.min(latestTimestamp, Math.max(0, duration * point)));
    const frames: string[] = [];

    for (const time of timestamps) {
      await new Promise<void>((resolve, reject) => {
        video.onseeked = () => resolve();
        video.onerror = () => reject(new Error("Could not read video frame"));
        video.currentTime = time;
      });

      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 1024 / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) continue;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(canvas.toDataURL("image/jpeg", 0.82));
    }

    return frames;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function processRecipeMediaFiles(files: FileList | null) {
  if (!files) return [];
  const frames: string[] = [];

  for (const file of Array.from(files).slice(0, 4)) {
    if (file.type.startsWith("image/")) {
      frames.push(await resizeImageDataUrl(await readFileAsDataUrl(file)));
    } else if (file.type.startsWith("video/")) {
      frames.push(...await extractVideoFrames(file));
    }
  }

  return frames.slice(0, 8);
}

export default function RecipesPage() {
  const scheduleUndoable = useUndoableAction();
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");
  const [goal, setGoal] = useState("all");
  const [difficulty, setDifficulty] = useState("all");
  const [mealCategory, setMealCategory] = useState("all");
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
  const [socialMediaDataUrls, setSocialMediaDataUrls] = useState<string[]>([]);
  const [socialMediaStatus, setSocialMediaStatus] = useState("");

  const recipesQuery = useListRecipes(
    {
      query: query || undefined,
      goal: goal !== "all" ? (goal as any) : undefined,
      difficulty: difficulty !== "all" ? (difficulty as any) : undefined,
    },
    { query: { enabled: viewMode === "all" } as any }
  );
  const recommendedQuery = useGetRecommendedRecipes({ query: { enabled: viewMode === "recommended" } as any });
  const socialQuery = useQuery({
    queryKey: ["social-recipes"],
    queryFn: () => apiJson<SocialRecipe[]>("/social-recipes"),
    enabled: viewMode === "social",
  });
  const { data: recipes, isLoading } = recipesQuery;
  const { data: recommended, isLoading: recLoading } = recommendedQuery;
  const { data: socialRecipes, isLoading: socialLoading, refetch: refetchSocialRecipes } = socialQuery;

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

  const importSocialMutation = useAppMutation({
    operation: "Import recipe",
    reference: "WRITE-RECIPE-IMPORT",
    successMessage: "The recipe was imported.",
    invalidate: [getListRecipesQueryKey()],
    mutationFn: async () => {
      await apiJson("/healthz");
      return apiJson<SocialRecipe>("/social-recipes", {
        method: "POST",
        body: JSON.stringify({
          ...socialForm,
          mediaDataUrls: socialMediaDataUrls,
          autoExtract: true,
          platform: socialForm.platform === "auto" ? undefined : socialForm.platform,
          servings: parseInt(socialForm.servings) || 2,
        }),
      });
    },
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
      setSocialMediaDataUrls([]);
      setSocialMediaStatus("");
      refetchSocialRecipes();
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

  const basketMutation = useAppMutation({
    operation: "Create recipe basket",
    reference: "WRITE-RECIPE-BASKET",
    successMessage: "A basket was created from the recipe.",
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
  const canImportSocial = Boolean(socialForm.sourceUrl || socialMediaDataUrls.length > 0);

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
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div>
                <h2 className="font-semibold">Import social recipe</h2>
                <p className="text-sm text-muted-foreground">Paste a public recipe link, or upload screenshots/video so AI can read visible recipe text.</p>
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
                <div className="space-y-1 md:col-span-2">
                  <Label>Recipe screenshots or video</Label>
                  <Input
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    onChange={async (event) => {
                      setSocialMediaStatus("Processing uploaded media...");
                      try {
                        const frames = await processRecipeMediaFiles(event.target.files);
                        setSocialMediaDataUrls(frames);
                        setSocialMediaStatus(frames.length > 0 ? `${frames.length} screenshot/frame(s) ready for AI analysis` : "No readable media frames found");
                      } catch (error) {
                        setSocialMediaDataUrls([]);
                        setSocialMediaStatus(error instanceof Error ? error.message : "Could not process uploaded media");
                      } finally {
                        event.target.value = "";
                      }
                    }}
                  />
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Upload className="h-3.5 w-3.5" />
                    <span>{socialMediaStatus || "Upload screenshots or a saved recipe video when TikTok/Instagram hides caption text."}</span>
                  </div>
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
              <Button
                onClick={() => importSocialMutation.mutate()}
                disabled={importSocialMutation.isPending || !canImportSocial}
              >
                {importSocialMutation.isPending ? "Analyzing recipe..." : "Analyze recipe and match local products"}
              </Button>
            </CardContent>
          </Card>

          {socialBusy ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1,2].map(i => <Skeleton key={i} className="h-44 rounded-xl" />)}
            </div>
          ) : socialQuery.isError ? (
            <PageError reference="DATA-SOCIAL-RECIPES" onRetry={() => void socialQuery.refetch()} isRetrying={socialQuery.isFetching} />
          ) : importedSocialRecipes.length === 0 ? (
            <PageEmpty title="No social recipes imported yet" description="Add a public post URL or upload visible recipe media before importing." action={<Button onClick={() => document.querySelector<HTMLInputElement>('input[placeholder^="https://www.tiktok.com"]')?.focus()}>Add recipe source</Button>} />
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
      ) : activeQuery.isError ? (
        <PageError reference="DATA-RECIPES" onRetry={() => void activeQuery.refetch()} isRetrying={activeQuery.isFetching} />
      ) : (displayRecipes ?? []).length === 0 ? (
        <PageEmpty title="No recipes match" description="Clear the search and meal filters to return to all recipes." action={<Button onClick={() => { setQuery(""); setGoal("all"); setDifficulty("all"); setMealCategory("all"); setViewMode("all"); }}>Clear filters</Button>} />
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
                {recipe.isSaved ? (
                  <ConfirmAction
                    title={`Remove ${recipe.name} from Saved?`}
                    description="You can save this recipe again later."
                    onConfirm={() => scheduleUndoable({ label: "Saved recipe removal", onCommit: () => unsaveMutation.mutate(recipe.id) })}
                  >
                    <button aria-label={`Remove ${recipe.name} from saved`} className="absolute top-2 right-2 h-8 w-8 bg-background/80 backdrop-blur rounded-full flex items-center justify-center hover:bg-background transition-colors" onClick={(event) => event.stopPropagation()}>
                      <BookmarkCheck className="h-4 w-4 text-primary" />
                    </button>
                  </ConfirmAction>
                ) : (
                  <button aria-label={`Save ${recipe.name}`} className="absolute top-2 right-2 h-8 w-8 bg-background/80 backdrop-blur rounded-full flex items-center justify-center hover:bg-background transition-colors" onClick={(event) => { event.stopPropagation(); saveMutation.mutate(recipe.id); }}>
                    <Bookmark className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                  <h3 className="text-white font-semibold leading-tight text-sm">{recipe.name}</h3>
                </div>
              </div>
              <CardContent className="p-3 space-y-2">
                <div className="flex flex-wrap gap-1">
                  {(recipe as any).mealTypeLabel && (
                    <Badge variant="outline" className="text-xs py-0">{(recipe as any).mealTypeLabel}</Badge>
                  )}
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
