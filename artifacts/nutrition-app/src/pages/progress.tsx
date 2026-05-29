import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { TrendingDown, Target, Scale, Award } from "lucide-react";

const today = new Date().toISOString().split("T")[0];

export default function ProgressPage() {
  const qc = useQueryClient();
  const { data: progress, isLoading } = useGetProgressSummary();
  const { data: goalSummary } = useGetGoalSummary();
  const { data: profile } = useGetProfile();
  const [weightInput, setWeightInput] = useState("");

  const logWeightMutation = useMutation({
    mutationFn: (weightKg: number) => upsertDailyLog(today, { weightKg }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getGetProgressSummaryQueryKey() });
      qc.invalidateQueries({ queryKey: getGetDailyLogQueryKey(today) });
      setWeightInput("");
    },
  });

  if (isLoading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-32" />)}</div>;

  const chartData = progress?.weeklyTrend?.map((d) => ({
    date: new Date(d.date).toLocaleDateString("en-AU", { month: "short", day: "numeric" }),
    weight: d.weightKg,
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
        <CardContent className="p-4">
          <Label className="text-sm font-medium mb-2 block">Log Today's Weight</Label>
          <div className="flex gap-2">
            <Input
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
            <div className="grid grid-cols-3 gap-3 text-center">
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
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Weight Trend</CardTitle>
          </CardHeader>
          <CardContent>
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
            {chartData.length === 0 && (
              <p className="text-center text-muted-foreground text-sm py-8">Log your weight daily to see the trend</p>
            )}
          </CardContent>
        </Card>
      )}

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
