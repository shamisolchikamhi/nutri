import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useGetDailyLog,
  useGetMealEntries,
  addMealEntry,
  deleteMealEntry,
  upsertDailyLog,
  getGetDailyLogQueryKey,
  getGetMealEntriesQueryKey,
  getGetDashboardTodayQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, Plus, Droplets } from "lucide-react";

const today = new Date().toISOString().split("T")[0];

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;

const COMMON_FOODS = [
  { name: "Chicken Breast 150g", calories: 248, proteinG: 46.5, carbsG: 0, fatG: 5.4 },
  { name: "Brown Rice 100g cooked", calories: 111, proteinG: 2.6, carbsG: 23, fatG: 0.9 },
  { name: "Egg (1 large)", calories: 78, proteinG: 6, carbsG: 0.6, fatG: 5 },
  { name: "Greek Yoghurt 200g", calories: 190, proteinG: 18, carbsG: 16, fatG: 4 },
  { name: "Banana (medium)", calories: 89, proteinG: 1.1, carbsG: 23, fatG: 0.3 },
  { name: "Rolled Oats 80g", calories: 303, proteinG: 10.4, carbsG: 52.8, fatG: 5.6 },
  { name: "Canned Tuna 95g", calories: 114, proteinG: 24.7, carbsG: 0, fatG: 1.9 },
  { name: "Broccoli 100g", calories: 34, proteinG: 2.8, carbsG: 6, fatG: 0.4 },
  { name: "Almond Butter 15g", calories: 92, proteinG: 3.2, carbsG: 2.1, fatG: 8.3 },
  { name: "Skim Milk 250ml", calories: 88, proteinG: 8.8, carbsG: 12.5, fatG: 0.5 },
];

export default function TrackerPage() {
  const qc = useQueryClient();
  const { data: log, isLoading } = useGetDailyLog(today);
  const { data: meals } = useGetMealEntries(today);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    mealType: "breakfast" as "breakfast" | "lunch" | "dinner" | "snack",
    calories: "",
    proteinG: "",
    carbsG: "",
    fatG: "",
    servings: "1",
  });

  const inv = () => {
    qc.invalidateQueries({ queryKey: getGetDailyLogQueryKey(today) });
    qc.invalidateQueries({ queryKey: getGetMealEntriesQueryKey(today) });
    qc.invalidateQueries({ queryKey: getGetDashboardTodayQueryKey() });
  };

  const addMutation = useMutation({
    mutationFn: () =>
      addMealEntry(today, {
        name: form.name,
        mealType: form.mealType,
        calories: parseInt(form.calories) || 0,
        proteinG: parseFloat(form.proteinG) || 0,
        carbsG: parseFloat(form.carbsG) || 0,
        fatG: parseFloat(form.fatG) || 0,
        servings: parseFloat(form.servings) || 1,
      }),
    onSuccess: () => { inv(); setOpen(false); resetForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ date, id }: { date: string; id: number }) => deleteMealEntry(date, id),
    onSuccess: inv,
  });

  const waterMutation = useMutation({
    mutationFn: (ml: number) => upsertDailyLog(today, { waterMl: ml }),
    onSuccess: inv,
  });

  const resetForm = () => setForm({ name: "", mealType: "breakfast" as const, calories: "", proteinG: "", carbsG: "", fatG: "", servings: "1" });

  const quickFill = (food: typeof COMMON_FOODS[0]) => {
    setForm((f) => ({ ...f, name: food.name, calories: String(food.calories), proteinG: String(food.proteinG), carbsG: String(food.carbsG), fatG: String(food.fatG) }));
  };

  const mealsByType = MEAL_TYPES.map((type) => ({
    type,
    entries: (meals ?? []).filter((m) => m.mealType === type),
  }));

  const calPct = log ? Math.min(100, (log.totalCalories / log.calorieTarget) * 100) : 0;
  const waterPct = log ? Math.min(100, (log.waterMl / 2500) * 100) : 0;

  if (isLoading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Meal Tracker</h1>
          <p className="text-muted-foreground text-sm">{new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Log Meal</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Log a Meal</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Quick fill */}
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Quick Add</Label>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {COMMON_FOODS.map((f) => (
                    <button key={f.name} onClick={() => quickFill(f)} className="text-xs bg-muted hover:bg-primary/10 hover:text-primary rounded-full px-2.5 py-1 transition-colors">
                      {f.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1 col-span-2">
                    <Label>Food Name</Label>
                    <Input value={form.name} onChange={(e) => setForm(f => ({...f, name: e.target.value}))} placeholder="e.g. Chicken Breast" />
                  </div>
                  <div className="space-y-1">
                    <Label>Meal Type</Label>
                    <Select value={form.mealType} onValueChange={(v) => setForm(f => ({...f, mealType: v as typeof f.mealType}))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MEAL_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Calories</Label>
                    <Input type="number" value={form.calories} onChange={(e) => setForm(f => ({...f, calories: e.target.value}))} placeholder="0" />
                  </div>
                  <div className="space-y-1">
                    <Label>Protein (g)</Label>
                    <Input type="number" value={form.proteinG} onChange={(e) => setForm(f => ({...f, proteinG: e.target.value}))} placeholder="0" />
                  </div>
                  <div className="space-y-1">
                    <Label>Carbs (g)</Label>
                    <Input type="number" value={form.carbsG} onChange={(e) => setForm(f => ({...f, carbsG: e.target.value}))} placeholder="0" />
                  </div>
                  <div className="space-y-1">
                    <Label>Fat (g)</Label>
                    <Input type="number" value={form.fatG} onChange={(e) => setForm(f => ({...f, fatG: e.target.value}))} placeholder="0" />
                  </div>
                </div>
                <Button className="w-full" onClick={() => addMutation.mutate()} disabled={!form.name || addMutation.isPending}>
                  {addMutation.isPending ? "Logging..." : "Log Entry"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Daily Progress */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Calories</span>
            <span className="text-sm font-bold">{log?.totalCalories ?? 0} / {log?.calorieTarget ?? 2000} kcal</span>
          </div>
          <Progress value={calPct} className="h-2.5" />
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: "Protein", val: Math.round(log?.totalProteinG ?? 0), target: log?.proteinTarget, unit: "g", color: "text-emerald-600" },
              { label: "Carbs", val: Math.round(log?.totalCarbsG ?? 0), target: log?.carbsTarget, unit: "g", color: "text-amber-600" },
              { label: "Fat", val: Math.round(log?.totalFatG ?? 0), target: log?.fatTarget, unit: "g", color: "text-purple-600" },
            ].map((m) => (
              <div key={m.label} className="bg-muted/50 rounded-lg p-2">
                <p className={`text-base font-bold ${m.color}`}>{m.val}{m.unit}</p>
                <p className="text-xs text-muted-foreground">{m.label}</p>
                {m.target && <p className="text-xs text-muted-foreground">/ {m.target}g</p>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Water Tracker */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium flex items-center gap-1.5"><Droplets className="h-4 w-4 text-blue-500" /> Water Intake</span>
            <span className="text-sm font-bold text-blue-600">{log?.waterMl ?? 0} / 2500 ml</span>
          </div>
          <Progress value={waterPct} className="h-2 mb-3" />
          <div className="flex gap-2 flex-wrap">
            {[250, 500, 1000].map((ml) => (
              <Button key={ml} variant="outline" size="sm" onClick={() => waterMutation.mutate((log?.waterMl ?? 0) + ml)}>
                +{ml}ml
              </Button>
            ))}
            {(log?.waterMl ?? 0) > 0 && (
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => waterMutation.mutate(0)}>
                Reset
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Meals by type */}
      {mealsByType.map(({ type, entries }) => (
        <div key={type}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold capitalize flex items-center gap-2">
              {type === "breakfast" ? "🌅" : type === "lunch" ? "🌤" : type === "dinner" ? "🌙" : "🍎"} {type}
            </h2>
            <span className="text-xs text-muted-foreground">
              {entries.reduce((s, e) => s + e.calories, 0)} kcal
            </span>
          </div>
          {entries.length === 0 ? (
            <div className="border-2 border-dashed rounded-xl p-4 text-center text-muted-foreground text-sm">
              No {type} logged yet
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => (
                <Card key={entry.id}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{entry.name}</p>
                      <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                        <span>{entry.calories} kcal</span>
                        <span>P: {entry.proteinG}g</span>
                        <span>C: {entry.carbsG}g</span>
                        <span>F: {entry.fatG}g</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteMutation.mutate({ date: today, id: entry.id })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
