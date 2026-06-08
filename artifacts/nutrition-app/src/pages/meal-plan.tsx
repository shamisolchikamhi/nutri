import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarDays, ChefHat, Flame, ShoppingCart, Target } from "lucide-react";
import { createBasketFromRecipes } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { formatMoney } from "@/lib/market";

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
    recipe: PlanRecipe;
  }>;
  totals: {
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    cost: number;
    calorieTarget: number;
    proteinTargetG: number;
    calorieCoveragePercent: number;
    proteinCoveragePercent: number;
  };
};

type MealPlan = {
  calorieTarget: number;
  proteinTargetG: number;
  savedRecipeCount: number;
  days: MealPlanDay[];
};

async function fetchMealPlan(days: number): Promise<MealPlan> {
  const response = await fetch(`/api/recipes/meal-plan?days=${days}`);
  if (!response.ok) throw new Error(`Request failed with ${response.status}`);
  return response.json() as Promise<MealPlan>;
}

export default function MealPlanPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [days, setDays] = useState(7);
  const { data: plan, isLoading, error } = useQuery({
    queryKey: ["meal-plan", days],
    queryFn: () => fetchMealPlan(days),
  });

  const basketMutation = useMutation({
    mutationFn: (day: MealPlanDay) =>
      createBasketFromRecipes({
        recipeIds: day.items.map((item) => item.recipe.id),
        name: `${day.label} Meal Plan Basket`,
        mode: "cheapest",
      }),
    onSuccess: (basket) => {
      toast({ title: "Basket created", description: `${basket.items.length} pack-based items added` });
      setLocation(`/basket/${basket.id}`);
    },
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
    return (
      <div className="text-center py-12 text-muted-foreground">
        <ChefHat className="h-10 w-10 mx-auto mb-2 opacity-30" />
        <p>Could not build a meal plan yet.</p>
      </div>
    );
  }

  const weeklyCost = plan.days.reduce((sum, day) => sum + day.totals.cost, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            Meal Plan
          </h1>
          <p className="text-sm text-muted-foreground">Daily recipe mixes matched to your protein and calorie goals.</p>
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

      <div className="space-y-4">
        {plan.days.map((day) => (
          <Card key={day.day}>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{day.label}</h2>
                  <p className="text-xs text-muted-foreground">
                    {day.totals.calories} kcal, {day.totals.proteinG}g protein, {formatMoney(day.totals.cost)}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => basketMutation.mutate(day)} disabled={basketMutation.isPending}>
                  <ShoppingCart className="h-4 w-4 mr-1" />
                  Basket
                </Button>
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
                  <button
                    key={`${day.day}-${item.slot}-${item.recipe.id}`}
                    className="rounded-lg border p-3 text-left hover:border-primary/40 transition-colors"
                    onClick={() => setLocation(`/recipes/${item.recipe.id}`)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap gap-1 mb-1">
                          <Badge variant="outline">{item.slotLabel}</Badge>
                          {item.recipe.isSaved && <Badge variant="secondary">Saved</Badge>}
                        </div>
                        <p className="font-medium text-sm">{item.recipe.name}</p>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <p>{item.recipe.caloriesPerServing} kcal</p>
                        <p>{item.recipe.proteinPerServingG}g protein</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
