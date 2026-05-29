import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useListActivityLogs,
  createActivityLog,
  deleteActivityLog,
  getListActivityLogsQueryKey,
  getGetDashboardTodayQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, Plus, Zap, Footprints } from "lucide-react";

const ACTIVITY_TYPES = [
  { value: "walking", label: "Walking" },
  { value: "running", label: "Running" },
  { value: "cycling", label: "Cycling" },
  { value: "swimming", label: "Swimming" },
  { value: "gym", label: "Gym/Weights" },
  { value: "hiit", label: "HIIT" },
  { value: "yoga", label: "Yoga" },
  { value: "sports", label: "Team Sports" },
  { value: "other", label: "Other" },
];

const today = new Date().toISOString().split("T")[0];

export default function ActivityPage() {
  const qc = useQueryClient();
  const { data: logs, isLoading } = useListActivityLogs();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    date: today,
    workoutType: "walking",
    workoutDurationMin: "",
    steps: "",
    activeCalories: "",
    sleepHours: "7",
    notes: "",
  });

  const inv = () => {
    qc.invalidateQueries({ queryKey: getListActivityLogsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetDashboardTodayQueryKey() });
  };

  const addMutation = useMutation({
    mutationFn: () =>
      createActivityLog({
        date: form.date,
        workoutType: form.workoutType || null,
        workoutDurationMin: parseInt(form.workoutDurationMin) || 0,
        steps: parseInt(form.steps) || 0,
        activeCalories: parseInt(form.activeCalories) || 0,
        sleepHours: parseFloat(form.sleepHours) || 7,
        notes: form.notes || null,
      } as any),
    onSuccess: () => { inv(); setOpen(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteActivityLog(id),
    onSuccess: inv,
  });

  const totalSteps = (logs ?? []).filter(l => l.date === today).reduce((s, l) => s + l.steps, 0);
  const totalCals = (logs ?? []).filter(l => l.date === today).reduce((s, l) => s + l.estimatedCaloriesBurned, 0);

  if (isLoading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-20" />)}</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Activity Log</h1>
          <p className="text-muted-foreground text-sm">Track your workouts and movement</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Add Activity</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Log Activity</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Date</Label>
                  <Input type="date" value={form.date} onChange={(e) => setForm(f => ({...f, date: e.target.value}))} />
                </div>
                <div className="space-y-1">
                  <Label>Activity Type</Label>
                  <Select value={form.workoutType} onValueChange={(v) => setForm(f => ({...f, workoutType: v}))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ACTIVITY_TYPES.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Duration (min)</Label>
                  <Input type="number" value={form.workoutDurationMin} onChange={(e) => setForm(f => ({...f, workoutDurationMin: e.target.value}))} placeholder="30" />
                </div>
                <div className="space-y-1">
                  <Label>Active Calories</Label>
                  <Input type="number" value={form.activeCalories} onChange={(e) => setForm(f => ({...f, activeCalories: e.target.value}))} placeholder="200" />
                </div>
                <div className="space-y-1">
                  <Label>Steps</Label>
                  <Input type="number" value={form.steps} onChange={(e) => setForm(f => ({...f, steps: e.target.value}))} placeholder="8000" />
                </div>
                <div className="space-y-1">
                  <Label>Notes</Label>
                  <Input value={form.notes} onChange={(e) => setForm(f => ({...f, notes: e.target.value}))} placeholder="Optional" />
                </div>
              </div>
              <Button className="w-full" onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
                {addMutation.isPending ? "Logging..." : "Log Activity"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Today summary */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-orange-100 flex items-center justify-center">
              <Zap className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Calories Burned</p>
              <p className="text-xl font-bold">{totalCals}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Footprints className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Steps Today</p>
              <p className="text-xl font-bold">{totalSteps.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Logs */}
      <div className="space-y-3">
        <h2 className="font-semibold">Recent Activity</h2>
        {(logs ?? []).length === 0 ? (
          <div className="border-2 border-dashed rounded-xl p-8 text-center text-muted-foreground">
            <Zap className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p>No activity logged yet</p>
            <p className="text-sm">Add your first workout above</p>
          </div>
        ) : (
          (logs ?? []).map((log) => (
            <Card key={log.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium capitalize">{log.workoutType ?? "Activity"}</p>
                    <span className="text-xs text-muted-foreground">{log.date}</span>
                  </div>
                  <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                    <span>{log.workoutDurationMin} min</span>
                    <span>{log.estimatedCaloriesBurned} kcal burned</span>
                    {log.steps > 0 && <span>{log.steps.toLocaleString()} steps</span>}
                  </div>
                  {log.notes && <p className="text-xs text-muted-foreground mt-0.5 italic">{log.notes}</p>}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteMutation.mutate(log.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
