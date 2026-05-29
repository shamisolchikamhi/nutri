import { useLocation } from "wouter";
import {
  useGetDashboardToday,
  useGetSnackSuggestions,
  useGetMealSuggestion,
  useGetGoalSummary,
  useGetProfile,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Flame, Droplets, Zap, Target, TrendingDown, ShoppingCart, Tag, Clock } from "lucide-react";

function MacroRing({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const pct = Math.min(100, (value / Math.max(max, 1)) * 100);
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-16 h-16">
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/30" />
          <circle
            cx="18" cy="18" r="15.9" fill="none" strokeWidth="3"
            stroke={color} strokeDasharray={`${pct} ${100 - pct}`}
            strokeLinecap="round" className="transition-all duration-500"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">{Math.round(pct)}%</span>
      </div>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium">{value}g</span>
    </div>
  );
}

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const { data: today, isLoading } = useGetDashboardToday();
  const { data: snacks } = useGetSnackSuggestions();
  const { data: mealSuggestion } = useGetMealSuggestion();
  const { data: goalSummary } = useGetGoalSummary();
  const { data: profile } = useGetProfile();

  const todayDate = new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });

  if (isLoading) {
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

  const calPct = today ? Math.min(100, (today.caloriesEaten / today.calorieTarget) * 100) : 0;

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
                <span className="text-4xl font-bold">{today?.caloriesEaten ?? 0}</span>
                <span className="text-primary-foreground/70 text-sm">/ {today?.calorieTarget ?? 2000} kcal</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-primary-foreground/80 text-sm">Remaining</p>
              <p className="text-2xl font-bold">{today?.caloriesRemaining ?? 0}</p>
            </div>
          </div>
          <div className="h-2 bg-primary-foreground/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-foreground rounded-full transition-all duration-700"
              style={{ width: `${calPct}%` }}
            />
          </div>
        </div>
        <CardContent className="p-4">
          <div className="flex justify-around">
            <MacroRing value={Math.round(today?.proteinEatenG ?? 0)} max={today?.proteinTargetG ?? 150} color="#10b981" label="Protein" />
            <MacroRing value={Math.round(today?.carbsEatenG ?? 0)} max={Math.round((today?.calorieTarget ?? 2000) * 0.5 / 4)} color="#f59e0b" label="Carbs" />
            <MacroRing value={Math.round(today?.fatEatenG ?? 0)} max={Math.round((today?.calorieTarget ?? 2000) * 0.25 / 9)} color="#8b5cf6" label="Fat" />
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
              <p className="text-xs text-muted-foreground">Goal: 2500 ml</p>
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
              <p className="font-semibold">{today?.basketCost != null ? `$${today.basketCost}` : "—"}</p>
              <p className="text-xs text-muted-foreground">Saved ${today?.savingsFromSpecials ?? 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Goal Summary */}
      {goalSummary && (
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
      )}

      {/* Suggested Meal */}
      {mealSuggestion && (
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation(`/recipes/${mealSuggestion.id}`)}>
          <CardContent className="p-4">
            <div className="flex gap-4">
              <img
                src={mealSuggestion.imageUrl}
                alt={mealSuggestion.name}
                className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=200"; }}
              />
              <div className="min-w-0">
                <Badge variant="secondary" className="text-xs mb-1">Suggested Meal</Badge>
                <h3 className="font-semibold leading-tight">{mealSuggestion.name}</h3>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Flame className="h-3 w-3" />{mealSuggestion.caloriesPerServing} kcal</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{(mealSuggestion.prepTimeMin ?? 0) + (mealSuggestion.cookTimeMin ?? 0)} min</span>
                  <span>${mealSuggestion.estimatedCost}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
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
              <div key={snack.productId} className="flex-shrink-0 w-36 bg-card border rounded-xl p-3 space-y-1.5">
                <img
                  src={snack.imageUrl}
                  alt={snack.name}
                  className="w-full h-20 object-cover rounded-lg"
                  onError={(e) => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1547592180-85f173990554?w=200"; }}
                />
                <p className="text-xs font-medium leading-tight line-clamp-2">{snack.name}</p>
                <p className="text-xs text-muted-foreground">{snack.caloriesPerServing} kcal</p>
                <p className="text-xs font-semibold text-primary">${snack.priceAud}</p>
                {snack.isOnSpecial && (
                  <Badge variant="secondary" className="text-xs py-0">SPECIAL</Badge>
                )}
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
