import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { upsertProfile, getGetProfileQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { formatMoney, getBudgetLabel } from "@/lib/market";

const STEPS = ["Welcome", "Body Stats", "Diet & Activity", "Done"];

const DIETS = [
  { value: "standard", label: "Standard", emoji: "🍽", desc: "Balanced nutrition" },
  { value: "high_protein", label: "High Protein", emoji: "💪", desc: "Build muscle & recover" },
  { value: "low_calorie", label: "Low Calorie", emoji: "🔥", desc: "Lose fat efficiently" },
  { value: "low_carb", label: "Low Carb", emoji: "🥑", desc: "Reduce carbohydrates" },
  { value: "vegan", label: "Vegan", emoji: "🌿", desc: "Plant-based only" },
  { value: "vegetarian", label: "Vegetarian", emoji: "🥗", desc: "No meat" },
];

const ACTIVITY = [
  { value: "sedentary", label: "Sedentary", desc: "Little or no exercise" },
  { value: "lightly_active", label: "Lightly Active", desc: "Exercise 1-3 days/week" },
  { value: "moderately_active", label: "Moderately Active", desc: "Exercise 3-5 days/week" },
  { value: "very_active", label: "Very Active", desc: "Hard exercise 6-7 days" },
  { value: "extra_active", label: "Extra Active", desc: "Very hard exercise daily" },
];

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Could not save your profile. Please try again.";
}

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    sex: "male",
    ageYears: "",
    currentWeightKg: "",
    targetWeightKg: "",
    heightCm: "",
    dietPreference: "standard",
    dietPreferences: ["standard"],
    activityLevel: "moderately_active",
    budgetWeekly: "150",
    mealFrequency: "3",
    retailerPreferences: [] as number[],
  });

  const mutation = useMutation({
    mutationFn: () =>
      upsertProfile({
        sex: form.sex as "male" | "female" | "other",
        ageYears: parseInt(form.ageYears) || 30,
        currentWeightKg: parseFloat(form.currentWeightKg) || 75,
        targetWeightKg: parseFloat(form.targetWeightKg) || 70,
        heightCm: parseFloat(form.heightCm) || 170,
        dietPreference: (form.dietPreferences[0] ?? form.dietPreference) as any,
        activityLevel: form.activityLevel as any,
        budgetWeekly: parseFloat(form.budgetWeekly) || 150,
        mealFrequency: parseInt(form.mealFrequency) || 3,
        retailerPreferences: form.retailerPreferences,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
      setStep(3);
    },
  });

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const toggleDietPreference = (value: string) => {
    setForm((f) => {
      if (value === "standard") {
        return { ...f, dietPreference: "standard", dietPreferences: ["standard"] };
      }

      const withoutStandard = f.dietPreferences.filter((preference) => preference !== "standard");
      const selected = withoutStandard.includes(value)
        ? withoutStandard.filter((preference) => preference !== value)
        : [...withoutStandard, value];
      const dietPreferences = selected.length > 0 ? selected : ["standard"];
      return {
        ...f,
        dietPreference: dietPreferences[0],
        dietPreferences,
      };
    });
  };
  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-background to-teal-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 20A7 7 0 0 1 14 6c2 0 4 2 4 4 0 4-3 10-7 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">NutriBasket</h1>
          <p className="text-muted-foreground text-sm">Smart nutrition & grocery planning</p>
        </div>

        {step < 3 && (
          <div className="mb-6">
            <div className="flex justify-between text-xs text-muted-foreground mb-2">
              <span>Step {step + 1} of {STEPS.length - 1}</span>
              <span>{STEPS[step]}</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        <Card className="shadow-lg">
          <CardContent className="p-6">
            {step === 0 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-semibold mb-1">Welcome to NutriBasket!</h2>
                  <p className="text-muted-foreground text-sm">Let's set up your personalised nutrition profile.</p>
                </div>
                <div className="space-y-2">
                  <Label>Sex</Label>
                  <div className="flex gap-3">
                    {["male", "female", "other"].map((s) => (
                      <button
                        key={s}
                        onClick={() => set("sex", s)}
                        className={cn(
                          "flex-1 py-2.5 rounded-lg border-2 text-sm font-medium capitalize transition-all",
                          form.sex === s ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50"
                        )}
                      >
                        {s === "male" ? "♂ Male" : s === "female" ? "♀ Female" : "Other"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Age</Label>
                  <Input type="number" placeholder="30" value={form.ageYears} onChange={(e) => set("ageYears", e.target.value)} />
                </div>
                <Button className="w-full" onClick={() => setStep(1)}>Continue →</Button>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-semibold mb-1">Body Stats</h2>
                  <p className="text-muted-foreground text-sm">Used to calculate your personalised calorie targets.</p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>Height (cm)</Label>
                    <Input type="number" placeholder="170" value={form.heightCm} onChange={(e) => set("heightCm", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Weight (kg)</Label>
                    <Input type="number" placeholder="75" value={form.currentWeightKg} onChange={(e) => set("currentWeightKg", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Target (kg)</Label>
                    <Input type="number" placeholder="70" value={form.targetWeightKg} onChange={(e) => set("targetWeightKg", e.target.value)} />
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(0)}>Back</Button>
                  <Button className="flex-1" onClick={() => setStep(2)}>Continue →</Button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-semibold mb-1">Diet & Activity</h2>
                  <p className="text-muted-foreground text-sm">Shapes your recipe recommendations and calorie targets.</p>
                </div>
                <div className="space-y-2">
                  <Label>Diet Preference</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {DIETS.map((d) => (
                      <button
                        key={d.value}
                        onClick={() => toggleDietPreference(d.value)}
                        className={cn(
                          "p-3 rounded-xl border-2 text-left text-sm transition-all",
                          form.dietPreferences.includes(d.value) ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                        )}
                      >
                        <div className="text-lg mb-0.5">{d.emoji}</div>
                        <div className="font-medium">{d.label}</div>
                        <div className="text-xs text-muted-foreground">{d.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Activity Level</Label>
                  <div className="space-y-1.5">
                    {ACTIVITY.map((a) => (
                      <button
                        key={a.value}
                        onClick={() => set("activityLevel", a.value)}
                        className={cn(
                          "w-full p-2.5 rounded-lg border-2 text-left text-sm transition-all",
                          form.activityLevel === a.value ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                        )}
                      >
                        <span className="font-medium">{a.label}</span>
                        <span className="text-muted-foreground ml-2 text-xs">{a.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>{getBudgetLabel()}</Label>
                    <Input type="number" placeholder="150" value={form.budgetWeekly} onChange={(e) => set("budgetWeekly", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>Meals per day</Label>
                    <Input type="number" placeholder="3" min="1" max="6" value={form.mealFrequency} onChange={(e) => set("mealFrequency", e.target.value)} />
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>Back</Button>
                  <Button className="flex-1" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
                    {mutation.isPending ? "Saving..." : "Complete Setup"}
                  </Button>
                </div>
                {mutation.error && (
                  <p className="text-sm text-destructive">
                    {getErrorMessage(mutation.error)}
                  </p>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="text-center space-y-5 py-4">
                <div className="text-5xl">🎉</div>
                <div>
                  <h2 className="text-xl font-semibold mb-1">You're all set!</h2>
                  <p className="text-muted-foreground text-sm">Your personalised calorie targets and recommendations are ready.</p>
                </div>
                <div className="bg-primary/10 rounded-xl p-4 text-left space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Diet</span>
                    <span className="font-medium capitalize text-right">
                      {form.dietPreferences.map((preference) => preference.replace("_", " ")).join(", ")}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Activity</span>
                    <span className="font-medium capitalize">{form.activityLevel.replace("_", " ")}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Weekly Budget</span>
                    <span className="font-medium">{formatMoney(parseFloat(form.budgetWeekly) || 0)}</span>
                  </div>
                </div>
                <Button className="w-full text-base py-5" onClick={() => setLocation("/dashboard")}>
                  Go to Dashboard →
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
