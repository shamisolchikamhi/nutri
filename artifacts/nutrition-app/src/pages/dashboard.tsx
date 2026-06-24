import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  useGetDashboardToday,
  useGetSnackSuggestions,
  useGetMealSuggestion,
  useGetGoalSummary,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Flame, Droplets, Zap, Target, TrendingDown, ShoppingCart, Tag, ClipboardList } from "lucide-react";
import { formatDate, formatMoney } from "@/lib/market";
import { PageError } from "@/components/PageState";
import { DEFAULT_HYDRATION_TARGET_ML } from "@workspace/nutrition";
import { RecipeCard } from "@/components/content/RecipeCard";
import { ProductCard } from "@/components/content/ProductCard";

type WeeklyReview = {
  weekStart: string;
  weekEnd: string;
  adherencePercent: number;
  spend: number;
  wasteFlags: string[];
  weightTrendKg: number | null;
  energy: string;
  preferredMeals: string[];
  suggestions: string[];
};

async function fetchWeeklyReview(): Promise<WeeklyReview> {
  const response = await fetch("/api/dashboard/weekly-review");
  if (!response.ok) throw new Error(`Request failed with ${response.status}`);
  return response.json() as Promise<WeeklyReview>;
}

function MacroRing({ value, max, color, label }: { value: number | null; max: number | null; color: string; label: string }) {
  const pct = value != null && max != null && max > 0 ? Math.min(100, (value / max) * 100) : null;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-16 h-16">
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/30" />
          <circle
            cx="18" cy="18" r="15.9" fill="none" strokeWidth="3"
            stroke={color} strokeDasharray={`${pct ?? 0} ${100 - (pct ?? 0)}`}
            strokeLinecap="round" className="transition-all duration-500"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">{pct == null ? "—" : `${Math.round(pct)}%`}</span>
      </div>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium">{value == null || max == null ? "Unavailable" : `${value}g / ${max}g`}</span>
    </div>
  );
}

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const todayQuery = useGetDashboardToday();
  const snacksQuery = useGetSnackSuggestions();
  const mealQuery = useGetMealSuggestion();
  const goalQuery = useGetGoalSummary();
  const weeklyReviewQuery = useQuery({ queryKey: ["dashboard-weekly-review"], queryFn: fetchWeeklyReview });
  const { data: today } = todayQuery;
  const { data: snacks } = snacksQuery;
  const { data: mealSuggestion } = mealQuery;
  const { data: goalSummary } = goalQuery;

  const todayDate = formatDate(new Date(), { weekday: "long", day: "numeric", month: "long" });

  if (todayQuery.isLoading || weeklyReviewQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  const failedQuery = [todayQuery, snacksQuery, mealQuery, goalQuery, weeklyReviewQuery].find((query) => query.isError);
  if (failedQuery) return <PageError reference="DATA-DASHBOARD" onRetry={() => void failedQuery.refetch()} isRetrying={failedQuery.isFetching} />;

  const calorieTarget = today?.calorieTarget && today.calorieTarget > 0
    ? today.calorieTarget
    : goalSummary?.dailyCalorieTarget && goalSummary.dailyCalorieTarget > 0
      ? goalSummary.dailyCalorieTarget
      : null;
  const caloriesEaten = today?.caloriesEaten ?? null;
  const caloriesRemaining = calorieTarget == null || caloriesEaten == null
    ? null
    : today?.calorieTarget && today.calorieTarget > 0
      ? today.caloriesRemaining
      : Math.max(0, calorieTarget - caloriesEaten);
  const calPct = calorieTarget == null || caloriesEaten == null ? null : Math.min(100, (caloriesEaten / calorieTarget) * 100);
  const proteinTarget = today?.proteinTargetG && today.proteinTargetG > 0
    ? today.proteinTargetG
    : goalSummary?.proteinTargetG && goalSummary.proteinTargetG > 0
      ? goalSummary.proteinTargetG
      : null;
  const carbsTarget = goalSummary?.carbsTargetG && goalSummary.carbsTargetG > 0 ? goalSummary.carbsTargetG : null;
  const fatTarget = goalSummary?.fatTargetG && goalSummary.fatTargetG > 0 ? goalSummary.fatTargetG : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}!
          </h1>
          <p className="text-muted-foreground text-sm">{todayDate}</p>
        </div>
        {today?.streak && today.streak > 0 ? (
          <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-full px-3 py-1.5">
            <span className="text-lg">🔥</span>
            <span className="text-sm font-semibold text-amber-700">{today.streak} day streak</span>
          </div>
        ) : null}
      </div>

      {/* Calorie Card */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-primary to-emerald-400 p-5 text-primary-foreground">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-primary-foreground/80 text-sm font-medium">Calories Today</p>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-4xl font-bold">{caloriesEaten ?? "—"}</span>
                <span className="text-primary-foreground/70 text-sm">{calorieTarget == null ? "Target unavailable" : `/ ${calorieTarget} kcal`}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-primary-foreground/80 text-sm">Remaining</p>
              <p className="text-2xl font-bold">{caloriesRemaining ?? "—"}</p>
            </div>
          </div>
          <div className="h-2 bg-primary-foreground/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-foreground rounded-full transition-all duration-700"
              style={{ width: `${calPct ?? 0}%` }}
            />
          </div>
        </div>
        <CardContent className="p-4">
          <div className="flex justify-around">
            <MacroRing value={today ? Math.round(today.proteinEatenG) : null} max={proteinTarget} color="#10b981" label="Protein" />
            <MacroRing value={today ? Math.round(today.carbsEatenG) : null} max={carbsTarget} color="#f59e0b" label="Carbs" />
            <MacroRing value={today ? Math.round(today.fatEatenG) : null} max={fatTarget} color="#8b5cf6" label="Fat" />
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Droplets className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Water</p>
              <p className="font-semibold">{today?.waterMl ?? 0} ml</p>
              <p className="text-xs text-muted-foreground">Goal: {DEFAULT_HYDRATION_TARGET_ML} ml</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
              <Zap className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Active Cal.</p>
              <p className="font-semibold">{today?.activeCaloriesBurned ?? 0}</p>
              <p className="text-xs text-muted-foreground">Burned today</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
              <Target className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Goal Progress</p>
              <p className="font-semibold">{today?.goalProgressPercent ?? 0}%</p>
              <Progress value={today?.goalProgressPercent ?? 0} className="h-1 mt-1 w-20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <ShoppingCart className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Basket Cost</p>
              <p className="font-semibold">{today?.basketCost != null ? formatMoney(today.basketCost) : "—"}</p>
              <p className="text-xs text-muted-foreground">Saved {formatMoney(today?.savingsFromSpecials)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Goal Summary */}
      {goalSummary?.dailyCalorieTarget && goalSummary.dailyCalorieTarget > 0 && goalSummary.proteinTargetG > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-primary" /> Your Targets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-primary">{goalSummary.dailyCalorieTarget}</p>
                <p className="text-xs text-muted-foreground">kcal/day</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-600">{goalSummary.proteinTargetG}g</p>
                <p className="text-xs text-muted-foreground">protein</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-500">{goalSummary.estimatedWeeksToGoal}w</p>
                <p className="text-xs text-muted-foreground">to goal</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-muted-foreground" /> Nutrition targets unavailable
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Complete your health profile before using calorie and macro targets.</p>
            <Button variant="outline" size="sm" onClick={() => setLocation("/settings")}>Review profile</Button>
          </CardContent>
        </Card>
      )}

      {weeklyReviewQuery.data && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" /> Weekly Review
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-muted-foreground">Adherence</p>
                <p className="text-lg font-bold">{weeklyReviewQuery.data.adherencePercent}%</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-muted-foreground">Spend</p>
                <p className="text-lg font-bold">{formatMoney(weeklyReviewQuery.data.spend)}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-muted-foreground">Weight trend</p>
                <p className="text-lg font-bold">{weeklyReviewQuery.data.weightTrendKg == null ? "—" : `${weeklyReviewQuery.data.weightTrendKg}kg`}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-muted-foreground">Energy</p>
                <p className="text-sm font-medium">{weeklyReviewQuery.data.energy}</p>
              </div>
            </div>
            {weeklyReviewQuery.data.preferredMeals.length > 0 && (
              <p className="text-sm text-muted-foreground">Preferred meals: {weeklyReviewQuery.data.preferredMeals.join(", ")}</p>
            )}
            <div className="space-y-1">
              {weeklyReviewQuery.data.suggestions.slice(0, 2).map((suggestion) => (
                <p key={suggestion} className="text-sm">• {suggestion}</p>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Waste note: {weeklyReviewQuery.data.wasteFlags[0]}</p>
          </CardContent>
        </Card>
      )}

      {/* Suggested Meal */}
      {mealSuggestion && (
        <RecipeCard recipe={mealSuggestion} variant="suggestion" onOpen={() => setLocation(`/recipes/${mealSuggestion.id}`)} />
      )}

      {/* Snack Suggestions */}
      {snacks && snacks.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold flex items-center gap-2">
              <Tag className="h-4 w-4 text-amber-500" /> Snack Ideas
            </h2>
            <Button variant="ghost" size="sm" onClick={() => setLocation("/products")}>See all</Button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            {snacks.slice(0, 5).map((snack) => (
              <div key={snack.productId} className="w-36 flex-shrink-0">
                <ProductCard variant="compact" product={{ id: snack.productId, name: snack.name, imageUrl: snack.imageUrl, retailerName: snack.retailerName, price: snack.priceAud, isOnSpecial: snack.isOnSpecial, calories: snack.caloriesPerServing }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Button className="h-12" onClick={() => setLocation("/tracker")}>
          + Log Meal
        </Button>
        <Button variant="outline" className="h-12" onClick={() => setLocation("/recipes")}>
          Browse Recipes
        </Button>
        <Button variant="outline" className="h-12" onClick={() => setLocation("/specials")}>
          View Specials
        </Button>
        <Button variant="outline" className="h-12" onClick={() => setLocation("/basket")}>
          My Basket
        </Button>
      </div>
    </div>
  );
}
