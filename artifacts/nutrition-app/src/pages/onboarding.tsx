import { useState } from "react";
import { useLocation } from "wouter";
import { useAppMutation } from "@/hooks/use-app-mutation";
import { upsertProfile, getGetProfileQueryKey, type UserProfileInput } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { formatMoney, getBudgetLabel } from "@/lib/market";
import {
  ACTIVITY_OPTIONS,
  DIET_OPTIONS,
  createEmptyProfileForm,
  toggleDiet,
  validateProfile,
  type ProfileErrors,
  type ProfileField,
  type ProfileForm,
} from "@/lib/profile-form";

const STEPS = ["Welcome", "Body Stats", "Diet & Activity", "Done"];

const DIET_DETAILS: Record<string, { emoji: string; desc: string }> = {
  standard: { emoji: "🍽", desc: "Balanced nutrition" },
  high_protein: { emoji: "💪", desc: "Build muscle & recover" },
  low_calorie: { emoji: "🔥", desc: "Lose fat efficiently" },
  low_carb: { emoji: "🥑", desc: "Reduce carbohydrates" },
  vegan: { emoji: "🌿", desc: "Plant-based only" },
  vegetarian: { emoji: "🥗", desc: "No meat" },
  halal: { emoji: "🍲", desc: "Halal food choices" },
};

const ACTIVITY_DETAILS: Record<string, string> = {
  sedentary: "Little or no exercise",
  lightly_active: "Exercise 1-3 days/week",
  moderately_active: "Exercise 3-5 days/week",
  very_active: "Hard exercise 6-7 days",
  extra_active: "Very hard exercise daily",
};

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [, setLocation] = useLocation();

  const [form, setForm] = useState<ProfileForm>(createEmptyProfileForm);
  const [errors, setErrors] = useState<ProfileErrors>({});

  const mutation = useAppMutation({
    operation: "Save profile",
    reference: "WRITE-PROFILE-ONBOARDING",
    successMessage: "Your profile is ready.",
    invalidate: [getGetProfileQueryKey()],
    mutationFn: (input: UserProfileInput) => upsertProfile(input),
    onSuccess: () => {
      setStep(3);
    },
  });

  const set = <K extends ProfileField>(key: K, value: ProfileForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };
  const validateStep = (fields: ProfileField[], nextStep: number) => {
    const result = validateProfile(form, fields);
    setErrors(result.errors);
    if (Object.keys(result.errors).length === 0) setStep(nextStep);
  };
  const submitProfile = () => {
    const result = validateProfile(form);
    setErrors(result.errors);
    if (result.input) mutation.mutate(result.input);
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
                    {(["male", "female", "other"] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => set("sex", s)}
                        aria-pressed={form.sex === s}
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
                  <Label htmlFor="onboarding-age">Age</Label>
                  <Input id="onboarding-age" type="number" placeholder="30" min="13" max="120" value={form.ageYears} onChange={(e) => set("ageYears", e.target.value)} aria-invalid={Boolean(errors.ageYears)} aria-describedby={errors.ageYears ? "onboarding-age-error" : "onboarding-age-help"} />
                  {!errors.ageYears && <p id="onboarding-age-help" className="text-xs text-muted-foreground">For people aged 13–120. Used to estimate your daily energy needs.</p>}
                  {errors.ageYears && <p id="onboarding-age-error" className="text-xs text-destructive" role="alert">{errors.ageYears}</p>}
                </div>
                <Button className="w-full" onClick={() => validateStep(["ageYears"], 1)}>Continue →</Button>
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
                    <Label htmlFor="onboarding-height">Height (cm)</Label>
                    <Input id="onboarding-height" autoFocus type="number" placeholder="170" min="100" max="250" value={form.heightCm} onChange={(e) => set("heightCm", e.target.value)} aria-invalid={Boolean(errors.heightCm)} aria-describedby="onboarding-height-help" />
                    {!errors.heightCm && <p id="onboarding-height-help" className="text-xs text-muted-foreground">100–250 cm</p>}
                    {errors.heightCm && <p className="text-xs text-destructive" role="alert">{errors.heightCm}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="onboarding-weight">Current weight (kg)</Label>
                    <Input id="onboarding-weight" type="number" placeholder="75" min="25" max="350" step="0.1" value={form.currentWeightKg} onChange={(e) => set("currentWeightKg", e.target.value)} aria-invalid={Boolean(errors.currentWeightKg)} aria-describedby="onboarding-weight-help" />
                    {!errors.currentWeightKg && <p id="onboarding-weight-help" className="text-xs text-muted-foreground">25–350 kg</p>}
                    {errors.currentWeightKg && <p className="text-xs text-destructive" role="alert">{errors.currentWeightKg}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="onboarding-target">Target weight (kg)</Label>
                    <Input id="onboarding-target" type="number" placeholder="70" min="25" max="350" step="0.1" value={form.targetWeightKg} onChange={(e) => set("targetWeightKg", e.target.value)} aria-invalid={Boolean(errors.targetWeightKg)} aria-describedby="onboarding-target-help" />
                    {!errors.targetWeightKg && <p id="onboarding-target-help" className="text-xs text-muted-foreground">Used to tailor a realistic calorie target.</p>}
                    {errors.targetWeightKg && <p className="text-xs text-destructive" role="alert">{errors.targetWeightKg}</p>}
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(0)}>Back</Button>
                  <Button className="flex-1" onClick={() => validateStep(["heightCm", "currentWeightKg", "targetWeightKg"], 2)}>Continue →</Button>
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
                    {DIET_OPTIONS.map((d) => (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => setForm((current) => toggleDiet(current, d.value))}
                        aria-pressed={form.dietPreferences.includes(d.value)}
                        className={cn(
                          "p-3 rounded-xl border-2 text-left text-sm transition-all",
                          form.dietPreferences.includes(d.value) ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                        )}
                      >
                        <div className="text-lg mb-0.5">{DIET_DETAILS[d.value].emoji}</div>
                        <div className="font-medium">{d.label}</div>
                        <div className="text-xs text-muted-foreground">{DIET_DETAILS[d.value].desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Activity Level</Label>
                  <div className="space-y-1.5">
                    {ACTIVITY_OPTIONS.map((a) => (
                      <button
                        key={a.value}
                        type="button"
                        onClick={() => set("activityLevel", a.value)}
                        aria-pressed={form.activityLevel === a.value}
                        className={cn(
                          "w-full p-2.5 rounded-lg border-2 text-left text-sm transition-all",
                          form.activityLevel === a.value ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                        )}
                      >
                        <span className="font-medium">{a.label}</span>
                        <span className="text-muted-foreground ml-2 text-xs">{ACTIVITY_DETAILS[a.value]}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="onboarding-budget">{getBudgetLabel()}</Label>
                    <Input id="onboarding-budget" type="number" placeholder="150" min="0" value={form.budgetWeekly} onChange={(e) => set("budgetWeekly", e.target.value)} aria-invalid={Boolean(errors.budgetWeekly)} aria-describedby="onboarding-budget-help" />
                    {!errors.budgetWeekly && <p id="onboarding-budget-help" className="text-xs text-muted-foreground">Helps prioritise recipes and shops within your spend.</p>}
                    {errors.budgetWeekly && <p className="text-xs text-destructive" role="alert">{errors.budgetWeekly}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="onboarding-meals">Meals per day</Label>
                    <Input id="onboarding-meals" type="number" placeholder="3" min="1" max="6" value={form.mealFrequency} onChange={(e) => set("mealFrequency", e.target.value)} aria-invalid={Boolean(errors.mealFrequency)} aria-describedby="onboarding-meals-help" />
                    {!errors.mealFrequency && <p id="onboarding-meals-help" className="text-xs text-muted-foreground">Choose 1–6 meals to shape your daily plan.</p>}
                    {errors.mealFrequency && <p className="text-xs text-destructive" role="alert">{errors.mealFrequency}</p>}
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>Back</Button>
                  <Button className="flex-1" onClick={submitProfile} disabled={mutation.isPending}>
                    {mutation.isPending ? "Saving..." : "Complete Setup"}
                  </Button>
                </div>
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
