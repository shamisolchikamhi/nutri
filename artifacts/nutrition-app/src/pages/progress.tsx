import { useState } from "react";
import { useAppMutation } from "@/hooks/use-app-mutation";
import {
  useGetProgressSummary,
  useGetGoalSummary,
  useGetProfile,
  upsertDailyLog,
  getGetProgressSummaryQueryKey,
  getGetDailyLogQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { Percent, TrendingDown, Target, Scale, Award } from "lucide-react";
import { PageError } from "@/components/PageState";
import { formatDate } from "@/lib/market";

const today = new Date().toISOString().split("T")[0];

export default function ProgressPage() {
  const progressQuery = useGetProgressSummary();
  const goalQuery = useGetGoalSummary();
  const profileQuery = useGetProfile();
  const { data: progress, isLoading } = progressQuery;
  const { data: goalSummary } = goalQuery;
  const { data: profile } = profileQuery;
  const [weightInput, setWeightInput] = useState("");
  const [bodyFatInput, setBodyFatInput] = useState("");

  const logWeightMutation = useAppMutation({
    operation: "Log weight",
    reference: "WRITE-WEIGHT",
    successMessage: "Your weight entry was saved.",
    invalidate: [getGetProgressSummaryQueryKey(), getGetDailyLogQueryKey(today)],
    mutationFn: (weightKg: number) => upsertDailyLog(today, { weightKg }),
    onSuccess: () => {
      setWeightInput("");
    },
  });

  const logBodyFatMutation = useAppMutation({
    operation: "Log body fat",
    reference: "WRITE-BODY-FAT",
    successMessage: "Your body fat entry was saved.",
    invalidate: [getGetProgressSummaryQueryKey(), getGetDailyLogQueryKey(today)],
    mutationFn: (bodyFatPercent: number) => upsertDailyLog(today, { bodyFatPercent }),
    onSuccess: () => {
      setBodyFatInput("");
    },
  });

  if (isLoading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-32" />)}</div>;
  const failedQuery = [progressQuery, goalQuery, profileQuery].find((query) => query.isError);
  if (failedQuery) return <PageError reference="DATA-PROGRESS" onRetry={() => void failedQuery.refetch()} isRetrying={failedQuery.isFetching} />;

  const chartData = progress?.weeklyTrend?.map((d) => ({
    date: formatDate(d.date, { month: "short", day: "numeric" }),
    weight: d.weightKg,
  })) ?? [];

  const bodyFatChartData = progress?.bodyFatTrend?.map((d) => ({
    date: formatDate(d.date, { month: "short", day: "numeric" }),
    bodyFat: d.bodyFatPercent,
  })) ?? [];

  const progressPercent = progress?.progressPercent ?? 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Progress</h1>
        <p className="text-muted-foreground text-sm">Track your journey to your goal</p>
      </div>

      {/* Weight Logger */}
      <Card>
        <CardContent className="grid gap-4 p-4 md:grid-cols-2">
          <div>
            <Label htmlFor="progress-weight" className="text-sm font-medium mb-2 block">Log Today's Weight</Label>
            <div className="flex gap-2">
              <Input
                id="progress-weight"
                type="number"
                placeholder={`${progress?.currentWeightKg ?? 75} kg`}
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={() => weightInput && logWeightMutation.mutate(parseFloat(weightInput))}
                disabled={!weightInput || logWeightMutation.isPending}
              >
                {logWeightMutation.isPending ? "Saving..." : "Log"}
              </Button>
            </div>
          </div>
          <div>
            <Label htmlFor="progress-body-fat" className="text-sm font-medium mb-2 block">Log Body Fat %</Label>
            <div className="flex gap-2">
              <Input
                id="progress-body-fat"
                type="number"
                placeholder={`${progress?.currentBodyFatPercent ?? profile?.bodyFatPercent ?? 24}%`}
                value={bodyFatInput}
                onChange={(e) => setBodyFatInput(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={() => bodyFatInput && logBodyFatMutation.mutate(parseFloat(bodyFatInput))}
                disabled={!bodyFatInput || logBodyFatMutation.isPending}
              >
                {logBodyFatMutation.isPending ? "Saving..." : "Log %"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Goal Progress */}
      {progress && (
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-primary to-emerald-400 p-5 text-primary-foreground">
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-4 w-4" />
              <p className="text-sm font-medium">Goal Progress</p>
            </div>
            <div className="text-3xl font-bold mb-3">{progressPercent}%</div>
            <div className="h-2.5 bg-primary-foreground/20 rounded-full overflow-hidden">
              <div className="h-full bg-primary-foreground rounded-full transition-all" style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="flex justify-between text-xs text-primary-foreground/80 mt-1">
              <span>Start: {progress.startWeightKg}kg</span>
              <span>Target: {progress.targetWeightKg}kg</span>
            </div>
          </div>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
              <div>
                <p className="text-2xl font-bold">{progress.currentWeightKg}</p>
                <p className="text-xs text-muted-foreground">Current (kg)</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-600">{progress.kgLost}</p>
                <p className="text-xs text-muted-foreground">Lost (kg)</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-500">{progress.kgToGo}</p>
                <p className="text-xs text-muted-foreground">To go (kg)</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-600">{progress.currentBodyFatPercent ?? "—"}</p>
                <p className="text-xs text-muted-foreground">Body fat (%)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Estimated Time */}
      {progress && goalSummary && (
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <TrendingDown className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Weeks to Goal</p>
                <p className="text-xl font-bold">{progress.estimatedWeeksRemaining}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-purple-100 flex items-center justify-center">
                <Scale className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Loss/Week</p>
                <p className="text-xl font-bold">{goalSummary.expectedWeeklyLossKg}kg</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Weight Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Weight Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis
                  domain={["auto", "auto"]}
                  tick={{ fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={35}
                  tickFormatter={(v) => `${v}kg`}
                />
                <Tooltip formatter={(v) => [`${v}kg`, "Weight"]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                {progress?.targetWeightKg && (
                  <ReferenceLine y={progress.targetWeightKg} stroke="#10b981" strokeDasharray="4 4" label={{ value: "Target", fontSize: 10 }} />
                )}
                <Line type="monotone" dataKey="weight" stroke="#10b981" strokeWidth={2} dot={{ r: 4, fill: "#10b981" }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center text-muted-foreground text-sm py-8 space-y-3">
              <p>Log your first weight before a trend can be calculated.</p>
              <Button variant="outline" onClick={() => document.querySelector<HTMLInputElement>('input[type="number"]')?.focus()}>Log first weight</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Body Fat Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Percent className="h-4 w-4 text-purple-600" /> Body Fat Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {bodyFatChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={bodyFatChartData}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis
                  domain={["auto", "auto"]}
                  tick={{ fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={35}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip formatter={(v) => [`${v}%`, "Body fat"]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Line type="monotone" dataKey="bodyFat" stroke="#9333ea" strokeWidth={2} dot={{ r: 4, fill: "#9333ea" }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center text-muted-foreground text-sm py-8 space-y-3">
              <p>Log body fat percentage to start tracking composition changes.</p>
              <Button variant="outline" onClick={() => document.querySelector<HTMLInputElement>("#progress-body-fat")?.focus()}>Log body fat</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Goal Summary */}
      {goalSummary && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Award className="h-4 w-4 text-primary" /> Daily Targets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "Calories", val: goalSummary.dailyCalorieTarget, unit: "kcal", max: goalSummary.maintenanceCalories, color: "bg-primary" },
              { label: "Protein", val: goalSummary.proteinTargetG, unit: "g", max: goalSummary.proteinTargetG * 1.5, color: "bg-emerald-500" },
              { label: "Carbs", val: goalSummary.carbsTargetG, unit: "g", max: goalSummary.carbsTargetG * 1.5, color: "bg-amber-500" },
              { label: "Fat", val: goalSummary.fatTargetG, unit: "g", max: goalSummary.fatTargetG * 1.5, color: "bg-purple-500" },
            ].map((m) => (
              <div key={m.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{m.label}</span>
                  <span className="font-medium">{m.val} {m.unit}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full ${m.color} rounded-full`} style={{ width: `${(m.val / m.max) * 100}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
