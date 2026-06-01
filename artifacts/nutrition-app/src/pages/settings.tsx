import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useGetProfile,
  useListRetailers,
  upsertProfile,
  getGetProfileQueryKey,
  getGetGoalSummaryQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Scale, Target, ShoppingBag, Save, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { MARKETS, type MarketCode, getBudgetLabel, getActiveMarket, setActiveMarket } from "@/lib/market";

const DIETS = [
  { value: "standard", label: "Standard" },
  { value: "high_protein", label: "High Protein" },
  { value: "low_calorie", label: "Low Calorie" },
  { value: "low_carb", label: "Low Carb" },
  { value: "vegan", label: "Vegan" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "halal", label: "Halal" },
];

const ACTIVITY_LEVELS = [
  { value: "sedentary", label: "Sedentary" },
  { value: "lightly_active", label: "Lightly Active" },
  { value: "moderately_active", label: "Moderately Active" },
  { value: "very_active", label: "Very Active" },
  { value: "extra_active", label: "Extra Active" },
];

export default function SettingsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: profile, isLoading } = useGetProfile();
  const { data: retailers } = useListRetailers();
  const [marketCode, setMarketCode] = useState<MarketCode>(getActiveMarket().code);

  const [form, setForm] = useState({
    sex: "male",
    ageYears: "",
    currentWeightKg: "",
    targetWeightKg: "",
    heightCm: "",
    bodyFatPercent: "",
    dietPreference: "standard",
    activityLevel: "moderately_active",
    budgetWeekly: "",
    mealFrequency: "3",
    retailerPreferences: [] as number[],
  });

  useEffect(() => {
    if (profile) {
      setForm({
        sex: profile.sex,
        ageYears: String(profile.ageYears),
        currentWeightKg: String(profile.currentWeightKg),
        targetWeightKg: String(profile.targetWeightKg),
        heightCm: String(profile.heightCm),
        bodyFatPercent: profile.bodyFatPercent != null ? String(profile.bodyFatPercent) : "",
        dietPreference: profile.dietPreference,
        activityLevel: profile.activityLevel,
        budgetWeekly: String(profile.budgetWeekly),
        mealFrequency: String(profile.mealFrequency),
        retailerPreferences: profile.retailerPreferences ?? [],
      });
    }
  }, [profile]);

  const saveMutation = useMutation({
    mutationFn: () =>
      upsertProfile({
        sex: form.sex as "male" | "female" | "other",
        ageYears: parseInt(form.ageYears),
        currentWeightKg: parseFloat(form.currentWeightKg),
        targetWeightKg: parseFloat(form.targetWeightKg),
        heightCm: parseFloat(form.heightCm),
        bodyFatPercent: form.bodyFatPercent ? parseFloat(form.bodyFatPercent) : null,
        dietPreference: form.dietPreference as any,
        activityLevel: form.activityLevel as any,
        budgetWeekly: parseFloat(form.budgetWeekly),
        mealFrequency: parseInt(form.mealFrequency),
        retailerPreferences: form.retailerPreferences,
      }),
    onSuccess: () => {
      setActiveMarket(marketCode);
      qc.invalidateQueries({ queryKey: getGetProfileQueryKey() });
      qc.invalidateQueries({ queryKey: getGetGoalSummaryQueryKey() });
      toast({ title: "Settings saved!", description: "Your profile has been updated." });
    },
  });

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const toggleRetailer = (id: number) => {
    setForm((f) => ({
      ...f,
      retailerPreferences: f.retailerPreferences.includes(id)
        ? f.retailerPreferences.filter((r) => r !== id)
        : [...f.retailerPreferences, id],
    }));
  };

  if (isLoading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-40" />)}</div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm">Update your profile and preferences</p>
      </div>

      {/* Personal Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4" /> Personal Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Sex</Label>
              <Select value={form.sex} onValueChange={(v) => set("sex", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Age</Label>
              <Input type="number" value={form.ageYears} onChange={(e) => set("ageYears", e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Body Stats */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Scale className="h-4 w-4" /> Body Stats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Height (cm)</Label>
              <Input type="number" value={form.heightCm} onChange={(e) => set("heightCm", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Current (kg)</Label>
              <Input type="number" value={form.currentWeightKg} onChange={(e) => set("currentWeightKg", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Target (kg)</Label>
              <Input type="number" value={form.targetWeightKg} onChange={(e) => set("targetWeightKg", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Body Fat %</Label>
              <Input type="number" placeholder="Optional" value={form.bodyFatPercent} onChange={(e) => set("bodyFatPercent", e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Goal & Activity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4" /> Diet & Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Diet Preference</Label>
            <div className="grid grid-cols-2 gap-2">
              {DIETS.map((d) => (
                <button
                  key={d.value}
                  onClick={() => set("dietPreference", d.value)}
                  className={cn(
                    "py-2 rounded-lg border-2 text-sm font-medium transition-all",
                    form.dietPreference === d.value ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/20"
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label>Activity Level</Label>
            <Select value={form.activityLevel} onValueChange={(v) => set("activityLevel", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACTIVITY_LEVELS.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Meals per day</Label>
            <Input type="number" min="1" max="6" value={form.mealFrequency} onChange={(e) => set("mealFrequency", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Shopping Preferences */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><ShoppingBag className="h-4 w-4" /> Shopping Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Home Market</Label>
            <Select value={marketCode} onValueChange={(v) => setMarketCode(v as MarketCode)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.values(MARKETS).map((market) => (
                  <SelectItem key={market.code} value={market.code}>
                    {market.name} ({market.currencyCode})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Controls currency display and future market-scoped grocery recommendations</p>
          </div>
          <div className="space-y-1">
            <Label>{getBudgetLabel(MARKETS[marketCode])}</Label>
            <Input type="number" value={form.budgetWeekly} onChange={(e) => set("budgetWeekly", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Preferred Retailers</Label>
            <div className="flex gap-2 flex-wrap">
              {(retailers ?? []).map((r) => (
                <button
                  key={r.id}
                  onClick={() => toggleRetailer(r.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-full border-2 text-sm font-medium transition-all",
                    form.retailerPreferences.includes(r.id) ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/30"
                  )}
                >
                  {r.name}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Select your preferred retailers for grocery recommendations</p>
          </div>
        </CardContent>
      </Card>

      <Button className="w-full h-12" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
        <Save className="h-4 w-4 mr-2" />
        {saveMutation.isPending ? "Saving..." : "Save Settings"}
      </Button>
    </div>
  );
}
