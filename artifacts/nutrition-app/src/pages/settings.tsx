import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useAppMutation } from "@/hooks/use-app-mutation";
import {
  useGetProfile,
  useListRetailers,
  upsertProfile,
  deleteProfile,
  getGetProfileQueryKey,
  getGetGoalSummaryQueryKey,
  type UserProfileInput,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Scale, Target, ShoppingBag, Save, Trash2, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { MARKETS, type MarketCode, getBudgetLabel, getActiveMarket, setActiveMarket } from "@/lib/market";
import { PageError } from "@/components/PageState";
import { ConfirmAction } from "@/components/ConfirmAction";
import {
  ACTIVITY_OPTIONS,
  DIET_OPTIONS,
  createEmptyProfileForm,
  profileToForm,
  toggleDiet,
  toggleRetailer,
  validateProfile,
  type ProfileErrors,
  type ProfileField,
  type ProfileForm,
} from "@/lib/profile-form";

export default function SettingsPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const profileQuery = useGetProfile();
  const retailersQuery = useListRetailers();
  const { data: profile, isLoading } = profileQuery;
  const { data: retailers } = retailersQuery;
  const [marketCode, setMarketCode] = useState<MarketCode>(getActiveMarket().code);

  const [form, setForm] = useState<ProfileForm>(createEmptyProfileForm);
  const [errors, setErrors] = useState<ProfileErrors>({});

  useEffect(() => {
    if (profile) {
      setForm(profileToForm(profile));
    }
  }, [profile]);

  const saveMutation = useAppMutation({
    operation: "Save settings",
    reference: "WRITE-SETTINGS",
    successMessage: "Your profile and preferences were updated.",
    invalidate: [getGetProfileQueryKey(), getGetGoalSummaryQueryKey()],
    mutationFn: (input: UserProfileInput) => upsertProfile(input),
    onSuccess: () => {
      setActiveMarket(marketCode);
    },
  });

  const deleteMutation = useAppMutation({
    operation: "Delete account",
    reference: "DELETE-ACCOUNT",
    successMessage: false,
    errorMessage: (error) => error instanceof Error
      ? `${error.message} Reference DELETE-ACCOUNT.`
      : "Nothing was changed. Contact support with reference DELETE-ACCOUNT.",
    mutationFn: () => deleteProfile(),
    onSuccess: () => {
      queryClient.clear();
      setLocation("/onboarding");
    },
  });

  const set = <K extends ProfileField>(key: K, value: ProfileForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };
  const submitSettings = () => {
    const result = validateProfile(form);
    setErrors(result.errors);
    if (result.input) saveMutation.mutate(result.input);
  };

  if (isLoading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-40" />)}</div>;
  const failedQuery = [profileQuery, retailersQuery].find((query) => query.isError);
  if (failedQuery) return <PageError reference="DATA-SETTINGS" onRetry={() => void failedQuery.refetch()} isRetrying={failedQuery.isFetching} />;

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
              <Select value={form.sex} onValueChange={(v) => set("sex", v as ProfileForm["sex"])}>
                <SelectTrigger aria-label="Sex"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="settings-age">Age</Label>
              <Input id="settings-age" type="number" value={form.ageYears} onChange={(e) => set("ageYears", e.target.value)} aria-invalid={Boolean(errors.ageYears)} />
              {errors.ageYears && <p className="text-xs text-destructive" role="alert">{errors.ageYears}</p>}
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
              <Label htmlFor="settings-height">Height (cm)</Label>
              <Input id="settings-height" type="number" value={form.heightCm} onChange={(e) => set("heightCm", e.target.value)} aria-invalid={Boolean(errors.heightCm)} />
              {errors.heightCm && <p className="text-xs text-destructive" role="alert">{errors.heightCm}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="settings-current-weight">Current (kg)</Label>
              <Input id="settings-current-weight" type="number" value={form.currentWeightKg} onChange={(e) => set("currentWeightKg", e.target.value)} aria-invalid={Boolean(errors.currentWeightKg)} />
              {errors.currentWeightKg && <p className="text-xs text-destructive" role="alert">{errors.currentWeightKg}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="settings-target-weight">Target (kg)</Label>
              <Input id="settings-target-weight" type="number" value={form.targetWeightKg} onChange={(e) => set("targetWeightKg", e.target.value)} aria-invalid={Boolean(errors.targetWeightKg)} />
              {errors.targetWeightKg && <p className="text-xs text-destructive" role="alert">{errors.targetWeightKg}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="settings-body-fat">Body Fat %</Label>
              <Input id="settings-body-fat" type="number" placeholder="Optional" value={form.bodyFatPercent} onChange={(e) => set("bodyFatPercent", e.target.value)} aria-invalid={Boolean(errors.bodyFatPercent)} />
              {errors.bodyFatPercent && <p className="text-xs text-destructive" role="alert">{errors.bodyFatPercent}</p>}
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
              {DIET_OPTIONS.map((d) => (
                <button
                  key={d.value}
                  onClick={() => setForm((current) => toggleDiet(current, d.value))}
                  className={cn(
                    "py-2 rounded-lg border-2 text-sm font-medium transition-all",
                    form.dietPreferences.includes(d.value) ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/20"
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label>Activity Level</Label>
            <Select value={form.activityLevel} onValueChange={(v) => set("activityLevel", v as ProfileForm["activityLevel"])}>
              <SelectTrigger aria-label="Activity Level"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACTIVITY_OPTIONS.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="settings-meals">Meals per day</Label>
            <Input id="settings-meals" type="number" min="1" max="6" value={form.mealFrequency} onChange={(e) => set("mealFrequency", e.target.value)} aria-invalid={Boolean(errors.mealFrequency)} />
            {errors.mealFrequency && <p className="text-xs text-destructive" role="alert">{errors.mealFrequency}</p>}
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
              <SelectTrigger aria-label="Home Market"><SelectValue /></SelectTrigger>
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
            <Label htmlFor="settings-budget">{getBudgetLabel(MARKETS[marketCode])}</Label>
            <Input id="settings-budget" type="number" value={form.budgetWeekly} onChange={(e) => set("budgetWeekly", e.target.value)} aria-invalid={Boolean(errors.budgetWeekly)} />
            {errors.budgetWeekly && <p className="text-xs text-destructive" role="alert">{errors.budgetWeekly}</p>}
          </div>
          <div className="space-y-1">
            <Label>Preferred Retailers</Label>
            <div className="flex gap-2 flex-wrap">
              {(retailers ?? []).map((r) => (
                <button
                  key={r.id}
                  onClick={() => setForm((current) => toggleRetailer(current, r.id))}
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

      <Button className="w-full h-12" onClick={submitSettings} disabled={saveMutation.isPending}>
        <Save className="h-4 w-4 mr-2" />
        {saveMutation.isPending ? "Saving..." : "Save Settings"}
      </Button>

      <Card className="border-destructive/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-destructive flex items-center gap-2">
            <Trash2 className="h-4 w-4" /> Delete account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Permanently delete your profile, logs, saved items, pantry, and baskets. This cannot be undone.
          </p>
          <ConfirmAction
            title="Delete your account?"
            description="This permanently deletes your profile and all of your NutriBasket data. This action cannot be undone."
            onConfirm={() => deleteMutation.mutate()}
          >
            <Button variant="destructive" disabled={deleteMutation.isPending}>
              <Trash2 className="h-4 w-4 mr-2" />
              {deleteMutation.isPending ? "Deleting..." : "Delete account"}
            </Button>
          </ConfirmAction>
        </CardContent>
      </Card>
    </div>
  );
}
