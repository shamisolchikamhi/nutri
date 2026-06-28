import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAppMutation } from "@/hooks/use-app-mutation";
import { CalendarDays, CheckCircle2, Flame, PackageCheck, RefreshCw, ShoppingCart, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/market";
import { PageError } from "@/components/PageState";

type PlanRecipe = {
  id: number;
  name: string;
  estimatedCost: number;
  caloriesPerServing: number;
  proteinPerServingG: number;
  carbsPerServingG: number;
  fatPerServingG: number;
  mealTypeLabel?: string;
  isSaved?: boolean;
};

type MealPlanDay = {
  day: number;
  label: string;
  items: Array<{
    slot: string;
    slotLabel: string;
    explanation: string;
    recipe: PlanRecipe;
    pantryMatches: string[];
    missingIngredients: string[];
  }>;
  totals: {
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    cost: number;
    householdCost: number;
    budgetRemaining: number | null;
    calorieTarget: number;
    proteinTargetG: number;
    calorieCoveragePercent: number;
    proteinCoveragePercent: number;
  };
};

type MealPlan = {
  calorieTarget: number;
  proteinTargetG: number;
  householdSize: number;
  budgetWeekly: number | null;
  maxCookingTime: number;
  dietaryRules: string[];
  pantryItems: string[];
  pantryInventory: Array<{ name: string; quantity: number; unit: string; expiresOn: string | null }>;
  preferredRetailers: string[];
  savedRecipeCount: number;
  days: MealPlanDay[];
};

type AdaptiveReplan = {
  remainingCalories: number;
  remainingProteinG: number;
  recommendation: null | {
    id: number;
    name: string;
    caloriesPerServing: number;
    proteinPerServingG: number;
    estimatedCost: number;
    reason: string;
    substitutions: Array<{ ingredient: string; substitute: string; reason: string }>;
    leftovers: string | null;
    wasteFlags: string[];
  };
};

type GoalToCartInputs = {
  householdSize: number;
  budgetWeekly: string;
  maxCookingTime: number;
  dietaryRules: string;
  preferredRetailers: string;
};

type PlanItem = MealPlanDay["items"][number];
type AcceptedPlan = {
  basket: {
    id: number;
    name: string;
    totalCost: number;
    items: Array<{ id: number; productName: string; quantity: number; unit: string }>;
  };
  pantryItemsUsed: string[];
};

async function fetchMealPlan(days: number, inputs: GoalToCartInputs): Promise<MealPlan> {
  const params = new URLSearchParams({
    days: String(days),
    householdSize: String(inputs.householdSize),
    maxCookingTime: String(inputs.maxCookingTime),
  });
  if (inputs.budgetWeekly) params.set("budgetWeekly", inputs.budgetWeekly);
  if (inputs.dietaryRules) params.set("dietaryRules", inputs.dietaryRules);
  if (inputs.preferredRetailers) params.set("preferredRetailers", inputs.preferredRetailers);

  const response = await fetch(`/api/recipes/meal-plan?${params}`);
  if (!response.ok) throw new Error(`Request failed with ${response.status}`);
  return normalizeMealPlan(await response.json());
}

export function normalizeMealPlan(value: unknown): MealPlan {
  if (!value || typeof value !== "object") throw new Error("Meal plan response is invalid");
  const raw = value as Partial<MealPlan>;
  if (!Array.isArray(raw.days) || typeof raw.calorieTarget !== "number" || typeof raw.proteinTargetG !== "number") {
    throw new Error("Meal plan response is incomplete");
  }
  return {
    calorieTarget: raw.calorieTarget,
    proteinTargetG: raw.proteinTargetG,
    householdSize: typeof raw.householdSize === "number" ? raw.householdSize : 1,
    budgetWeekly: typeof raw.budgetWeekly === "number" ? raw.budgetWeekly : null,
    maxCookingTime: typeof raw.maxCookingTime === "number" ? raw.maxCookingTime : 45,
    dietaryRules: Array.isArray(raw.dietaryRules) ? raw.dietaryRules : [],
    pantryItems: Array.isArray(raw.pantryItems) ? raw.pantryItems : [],
    pantryInventory: Array.isArray(raw.pantryInventory) ? raw.pantryInventory : [],
    preferredRetailers: Array.isArray(raw.preferredRetailers) ? raw.preferredRetailers : [],
    savedRecipeCount: typeof raw.savedRecipeCount === "number" ? raw.savedRecipeCount : 0,
    days: raw.days.map((day) => ({
      ...day,
      items: Array.isArray(day.items) ? day.items.map((item) => ({
        ...item,
        pantryMatches: Array.isArray(item.pantryMatches) ? item.pantryMatches : [],
        missingIngredients: Array.isArray(item.missingIngredients) ? item.missingIngredients : [],
      })) : [],
    })),
  };
}

async function fetchAdaptiveReplan(): Promise<AdaptiveReplan> {
  const response = await fetch("/api/recipes/adaptive-replan");
  if (!response.ok) throw new Error(`Request failed with ${response.status}`);
  return response.json() as Promise<AdaptiveReplan>;
}

export default function MealPlanPage() {
  const [, setLocation] = useLocation();
  const [days, setDays] = useState(7);
  const [inputs, setInputs] = useState<GoalToCartInputs>({
    householdSize: 1,
    budgetWeekly: "900",
    maxCookingTime: 45,
    dietaryRules: "",
    preferredRetailers: "",
  });
  const [swaps, setSwaps] = useState<Record<string, PlanItem>>({});
  const [acceptedPlan, setAcceptedPlan] = useState<AcceptedPlan | null>(null);
  const { data: plan, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["meal-plan", days, inputs],
    queryFn: () => fetchMealPlan(days, inputs),
  });
  const replanQuery = useQuery({
    queryKey: ["adaptive-replan"],
    queryFn: fetchAdaptiveReplan,
  });

  const swapMutation = useAppMutation<PlanItem, Error, { key: string; currentRecipeId: number; slot: string }>({
    operation: "Swap meal",
    reference: "WRITE-MEAL-PLAN-SWAP",
    successMessage: "The meal was swapped in this plan.",
    mutationFn: async ({ currentRecipeId, slot }) => {
      const response = await fetch(`/api/recipes/meal-plan/swap?currentRecipeId=${currentRecipeId}&slot=${encodeURIComponent(slot)}`);
      if (!response.ok) throw new Error("No suitable alternative meal is available right now.");
      return response.json() as Promise<PlanItem>;
    },
    onSuccess: (item, variables) => setSwaps((current) => ({ ...current, [variables.key]: item })),
  });

  const acceptMutation = useAppMutation<AcceptedPlan, Error, number[]>({
    operation: "Accept meal plan",
    reference: "WRITE-MEAL-PLAN-ACCEPT",
    successMessage: "Meal plan accepted. Your missing ingredients are ready as a shopping list.",
    mutationFn: async (recipeIds) => {
      const response = await fetch("/api/recipes/meal-plan/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipeIds }),
      });
      if (!response.ok) throw new Error("The plan could not be accepted. Your current plan is unchanged.");
      return response.json() as Promise<AcceptedPlan>;
    },
    onSuccess: setAcceptedPlan,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-28" />
        {[1, 2, 3].map((item) => <Skeleton key={item} className="h-56" />)}
      </div>
    );
  }

  if (error || !plan) {
    return <PageError reference="DATA-MEAL-PLAN" title="We couldn't build your meal plan" description="Complete your profile, then try again. Your current plan has not been changed." onRetry={() => void refetch()} isRetrying={isFetching} />;
  }

  const weeklyCost = plan.days.reduce((sum, day) => sum + day.totals.householdCost, 0);
  const displayedDays = plan.days.map((day) => ({
    ...day,
    items: day.items.map((item) => swaps[`${day.day}-${item.slot}`] ?? item),
  }));
  const displayedRecipeIds = displayedDays.flatMap((day) => day.items.map((item) => item.recipe.id));

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            Meal Plan
          </h1>
          <p className="text-sm text-muted-foreground">Pantry-first planning with easy swaps and a shopping list containing only what you are missing.</p>
        </div>
        <div className="flex gap-2">
          {[1, 7].map((value) => (
            <Button key={value} variant={days === value ? "default" : "outline"} size="sm" onClick={() => setDays(value)}>
              {value === 1 ? "Daily" : "Weekly"}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="household-size">Household size</Label>
            <Input id="household-size" type="number" min={1} max={12} value={inputs.householdSize} onChange={(event) => setInputs((current) => ({ ...current, householdSize: Number(event.target.value) || 1 }))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="weekly-budget">Weekly budget</Label>
            <Input id="weekly-budget" inputMode="decimal" value={inputs.budgetWeekly} onChange={(event) => setInputs((current) => ({ ...current, budgetWeekly: event.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cooking-time">Max cooking time</Label>
            <Input id="cooking-time" type="number" min={5} max={240} value={inputs.maxCookingTime} onChange={(event) => setInputs((current) => ({ ...current, maxCookingTime: Number(event.target.value) || 45 }))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="dietary-rules">Dietary rules</Label>
            <Input id="dietary-rules" placeholder="vegan, high_protein" value={inputs.dietaryRules} onChange={(event) => setInputs((current) => ({ ...current, dietaryRules: event.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="preferred-retailers">Preferred retailers</Label>
            <Input id="preferred-retailers" placeholder="Checkers, Pick n Pay" value={inputs.preferredRetailers} onChange={(event) => setInputs((current) => ({ ...current, preferredRetailers: event.target.value }))} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 font-semibold"><PackageCheck className="h-4 w-4 text-primary" /> Pantry inventory is prioritised</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {plan.pantryInventory.length > 0
                ? `Using ${plan.pantryInventory.map((item) => `${item.name} (${item.quantity} ${item.unit})`).join(", ")}.`
                : "No confirmed pantry items yet. Add and confirm items to make the plan pantry-first."}
            </p>
          </div>
          <Button variant="outline" onClick={() => setLocation("/pantry")}>Manage pantry</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 grid grid-cols-3 gap-3 text-center">
          <div>
            <Target className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-lg font-bold">{plan.proteinTargetG}g</p>
            <p className="text-xs text-muted-foreground">Protein target</p>
          </div>
          <div>
            <Flame className="h-5 w-5 mx-auto mb-1 text-amber-500" />
            <p className="text-lg font-bold">{plan.calorieTarget}</p>
            <p className="text-xs text-muted-foreground">Daily calories</p>
          </div>
          <div>
            <ShoppingCart className="h-5 w-5 mx-auto mb-1 text-emerald-600" />
            <p className="text-lg font-bold">{formatMoney(weeklyCost)}</p>
            <p className="text-xs text-muted-foreground">{days === 1 ? "Day cost" : "Plan cost"}</p>
          </div>
        </CardContent>
      </Card>

      {replanQuery.data?.recommendation && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">Adaptive replan</h2>
                <p className="text-xs text-muted-foreground">
                  {replanQuery.data.remainingCalories} kcal and {replanQuery.data.remainingProteinG}g protein remaining after today&apos;s logs.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setLocation(`/recipes/${replanQuery.data.recommendation!.id}`)}>
                Review meal
              </Button>
            </div>
            <div className="rounded-lg border p-3">
              <p className="font-medium text-sm">{replanQuery.data.recommendation.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{replanQuery.data.recommendation.reason}</p>
              {replanQuery.data.recommendation.substitutions.slice(0, 2).map((item) => (
                <p key={`${item.ingredient}-${item.substitute}`} className="mt-2 text-xs text-muted-foreground">{item.reason}</p>
              ))}
              {replanQuery.data.recommendation.leftovers && <p className="mt-2 text-xs text-muted-foreground">{replanQuery.data.recommendation.leftovers}</p>}
              {replanQuery.data.recommendation.wasteFlags.slice(0, 2).map((flag) => <p key={flag} className="mt-2 text-xs text-muted-foreground">{flag}</p>)}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold">Happy with this plan?</p>
          <p className="text-sm text-muted-foreground">Accept it to create a shopping list for missing ingredients only.</p>
        </div>
        <Button onClick={() => acceptMutation.mutate(displayedRecipeIds)} disabled={acceptMutation.isPending || displayedRecipeIds.length === 0}>
          <CheckCircle2 className="mr-2 h-4 w-4" />
          {acceptMutation.isPending ? "Creating shopping list..." : "Accept plan"}
        </Button>
      </div>

      {acceptedPlan && (
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">Plan accepted</p>
                <p className="text-sm text-muted-foreground">
                  {acceptedPlan.basket.items.length > 0
                    ? `${acceptedPlan.basket.items.length} missing item${acceptedPlan.basket.items.length === 1 ? "" : "s"} added to your shopping list.`
                    : "Your pantry already covers every matched ingredient."}
                </p>
              </div>
              <Button variant="outline" onClick={() => setLocation(`/basket/${acceptedPlan.basket.id}`)}>Open shopping list</Button>
            </div>
            {acceptedPlan.basket.items.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {acceptedPlan.basket.items.map((item) => <Badge key={item.id} variant="secondary">{item.productName} x{item.quantity}</Badge>)}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {displayedDays.map((day) => (
          <Card key={day.day}>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{day.label}</h2>
                  <p className="text-xs text-muted-foreground">
                    {day.totals.calories} kcal, {day.totals.proteinG}g protein, {formatMoney(day.totals.householdCost)}
                    {day.totals.budgetRemaining != null && `, ${formatMoney(day.totals.budgetRemaining)} budget left`}
                  </p>
                </div>
                <Badge variant="outline">{day.items.reduce((sum, item) => sum + item.missingIngredients.length, 0)} missing ingredients</Badge>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Calories</span>
                    <span>{day.totals.calorieCoveragePercent}%</span>
                  </div>
                  <Progress value={Math.min(100, day.totals.calorieCoveragePercent)} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Protein</span>
                    <span>{day.totals.proteinCoveragePercent}%</span>
                  </div>
                  <Progress value={Math.min(100, day.totals.proteinCoveragePercent)} className="h-2" />
                </div>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                {day.items.map((item) => (
                  <div
                    key={`${day.day}-${item.slot}-${item.recipe.id}`}
                    className="rounded-lg border p-3 text-left"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap gap-1 mb-1">
                          <Badge variant="outline">{item.slotLabel}</Badge>
                          {item.recipe.isSaved && <Badge variant="secondary">Saved</Badge>}
                        </div>
                        <p className="font-medium text-sm">{item.recipe.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{item.explanation}</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {item.pantryMatches.map((name) => <Badge key={name} className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">In pantry: {name}</Badge>)}
                          {item.missingIngredients.length > 0 && <Badge variant="outline">Shopping list: {item.missingIngredients.join(", ")}</Badge>}
                        </div>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <p>{item.recipe.caloriesPerServing} kcal</p>
                        <p>{item.recipe.proteinPerServingG}g protein</p>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => swapMutation.mutate({ key: `${day.day}-${item.slot}`, currentRecipeId: item.recipe.id, slot: item.slot })} disabled={swapMutation.isPending}>
                        <RefreshCw className="mr-1 h-3.5 w-3.5" /> Swap
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setLocation(`/recipes/${item.recipe.id}`)}>View recipe</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
