import { useGetWeeklySummary, useListDailyLogs } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Flame, Droplets, TrendingUp, Award } from "lucide-react";

export default function HistoryPage() {
  const { data: weekly, isLoading } = useGetWeeklySummary();
  const { data: logs } = useListDailyLogs();

  if (isLoading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-32" />)}</div>;

  const chartData = weekly?.days?.map((d) => ({
    day: new Date(d.date).toLocaleDateString("en-AU", { weekday: "short" }),
    calories: d.totalCalories,
    target: d.calorieTarget,
    onTarget: d.totalCalories > 0 && d.adherencePercent >= 80 && d.adherencePercent <= 115,
  })) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">History</h1>
        <p className="text-muted-foreground text-sm">Your weekly nutrition summary</p>
      </div>

      {/* Weekly Summary Stats */}
      {weekly && (
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <Flame className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg Daily Calories</p>
                <p className="text-xl font-bold">{weekly.avgDailyCalories}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <Droplets className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg Daily Water</p>
                <p className="text-xl font-bold">{weekly.avgDailyWaterMl}ml</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg Protein</p>
                <p className="text-xl font-bold">{weekly.avgDailyProteinG}g</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-purple-100 flex items-center justify-center">
                <Award className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Days On Target</p>
                <p className="text-xl font-bold">{weekly.daysOnTarget} / 7</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 7-Day Calorie Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">7-Day Calorie Intake</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} barSize={28}>
              <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                formatter={(value) => [`${value} kcal`, "Calories"]}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Bar dataKey="calories" radius={[6, 6, 0, 0]}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={d.onTarget ? "#10b981" : d.calories > 0 ? "#f59e0b" : "#e5e7eb"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground justify-center">
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-emerald-500" /> On target</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-amber-400" /> Logged</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-gray-200" /> No data</span>
          </div>
        </CardContent>
      </Card>

      {/* Daily Breakdown */}
      {weekly?.days && (
        <div className="space-y-2">
          <h2 className="font-semibold">Daily Breakdown</h2>
          {[...weekly.days].reverse().map((day) => {
            const onTarget = day.totalCalories > 0 && day.adherencePercent >= 80 && day.adherencePercent <= 115;
            return (
              <Card key={day.date}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium text-sm">
                        {new Date(day.date).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })}
                      </p>
                      <p className="text-xs text-muted-foreground">{day.totalCalories} / {day.calorieTarget} kcal</p>
                    </div>
                    {day.totalCalories > 0 ? (
                      <Badge variant={onTarget ? "default" : "secondary"} className="text-xs">
                        {onTarget ? "On Target" : `${Math.round(day.adherencePercent)}%`}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">No data</Badge>
                    )}
                  </div>
                  {day.totalCalories > 0 && (
                    <>
                      <Progress value={Math.min(100, day.adherencePercent)} className="h-1.5 mb-2" />
                      <div className="flex gap-3 text-xs text-muted-foreground">
                        <span>P: {Math.round(day.totalProteinG)}g</span>
                        <span>C: {Math.round(day.totalCarbsG)}g</span>
                        <span>F: {Math.round(day.totalFatG)}g</span>
                        <span>💧 {day.waterMl}ml</span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
