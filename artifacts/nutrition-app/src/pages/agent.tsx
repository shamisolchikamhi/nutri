import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Bot, CalendarDays, PackagePlus, ShoppingCart, Shuffle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useUndoableAction } from "@/hooks/use-undoable-action";
import { AGENT_CALCULATION_SERVICES, calculationServicesForAction } from "@/lib/agent-calculations";
import { previewForAction } from "@/lib/agent-previews";
import { AGENT_SAFETY_BOUNDARIES } from "@/lib/agent-safety";
import { AGENT_TOOLS, toolsForAction } from "@/lib/agent-tools";

const ACTIONS = [
  {
    id: "weekly_plan",
    title: "Plan my week under R900",
    description: "Build a weekly Goal-to-Cart plan using your budget, household size, pantry, and preferred retailers.",
    route: "/meal-plan",
    icon: CalendarDays,
    inputs: ["budget", "household", "retailers"],
  },
  {
    id: "pantry_first",
    title: "Use what is in my pantry",
    description: "Prioritize meals that use confirmed pantry items and ingredients expiring soon.",
    route: "/pantry",
    icon: PackagePlus,
    inputs: ["pantry", "expiry", "recipes"],
  },
  {
    id: "dinner_swap",
    title: "Swap tonight's dinner",
    description: "Find a similar recipe that fits remaining calories, protein, time, and budget.",
    route: "/meal-plan",
    icon: Shuffle,
    inputs: ["logs", "recipes", "budget"],
  },
  {
    id: "cheaper_basket",
    title: "Make my basket cheaper",
    description: "Compare retailer prices and specials before changing basket contents.",
    route: "/basket",
    icon: ShoppingCart,
    inputs: ["basket", "prices", "specials"],
  },
];

const AGENT_MEMORY_KEY = "nutribasket.agent.preferenceMemory";
const DEFAULT_MEMORY = "Prefers budget-aware, high-protein plans with pantry-first swaps and visible price trade-offs.";

export default function AgentPage() {
  const [, setLocation] = useLocation();
  const scheduleUndoable = useUndoableAction();
  const [previewActionId, setPreviewActionId] = useState<string | null>(null);
  const [memory, setMemory] = useState(DEFAULT_MEMORY);
  const [memoryStatus, setMemoryStatus] = useState("Stored locally. Edit or clear this any time.");
  const selectedPreview = previewActionId ? previewForAction(previewActionId) : undefined;

  useEffect(() => {
    const stored = window.localStorage.getItem(AGENT_MEMORY_KEY);
    if (stored != null) setMemory(stored);
  }, []);

  function saveMemory() {
    window.localStorage.setItem(AGENT_MEMORY_KEY, memory.trim());
    setMemoryStatus("Preference memory saved.");
  }

  function clearMemory() {
    window.localStorage.removeItem(AGENT_MEMORY_KEY);
    setMemory("");
    setMemoryStatus("Preference memory cleared.");
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bot className="h-6 w-6 text-primary" /> Nutri Agent
        </h1>
        <p className="text-sm text-muted-foreground">
          Start with a concrete action. The agent uses trusted app data and shows a preview before anything changes.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" /> Action boundaries
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm md:grid-cols-3">
          <p className="rounded-lg bg-muted/50 p-3">No open-ended medical advice or diagnosis.</p>
          <p className="rounded-lg bg-muted/50 p-3">Calculations use deterministic nutrition, basket, price, and pantry services.</p>
          <p className="rounded-lg bg-muted/50 p-3">Writes require preview and confirmation before they change plans or baskets.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Safety boundaries</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-2">
          {AGENT_SAFETY_BOUNDARIES.map((boundary) => (
            <div key={boundary.id} className="rounded-lg border p-3 text-sm">
              <p className="font-medium">{boundary.title}</p>
              <p className="mt-1 text-muted-foreground">{boundary.rule}</p>
              <p className="mt-1 text-xs text-amber-700">{boundary.userMessage}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {ACTIONS.map((action) => (
          <Card key={action.title}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-primary/10 p-2 text-primary">
                  <action.icon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-semibold">{action.title}</h2>
                  <p className="text-sm text-muted-foreground">{action.description}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {toolsForAction(action.id).map((tool) => (
                  <Badge key={tool.id} variant={tool.requiresConfirmation ? "outline" : "secondary"}>{tool.label}</Badge>
                ))}
              </div>
              <div className="rounded-lg bg-muted/40 p-2 text-xs text-muted-foreground">
                Service math: {calculationServicesForAction(action.id).filter((service) => service.owner === "deterministic_service").map((service) => service.label).join(", ")}.
                {" "}Model: intent, comparison, explanation, and tool orchestration.
              </div>
              <div className="flex flex-wrap gap-1">
                {action.inputs.map((input) => (
                  <Badge key={input} variant="secondary">{input}</Badge>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setPreviewActionId(action.id)}>
                  Preview diff
                </Button>
                <Button variant="ghost" onClick={() => setLocation(action.route)}>
                  Start action
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Typed tool surface</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-2">
          {AGENT_TOOLS.map((tool) => (
            <div key={tool.id} className="rounded-lg border p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{tool.label}</p>
                <Badge variant={tool.requiresConfirmation ? "outline" : "secondary"}>{tool.access.replace("_", " + ")}</Badge>
              </div>
              <p className="mt-1 text-muted-foreground">{tool.description}</p>
              {tool.requiresConfirmation && <p className="mt-1 text-xs text-amber-700">Preview and confirmation required before writes.</p>}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Preference memory</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Concise memory the agent can use for future suggestions. You can inspect, edit, or clear it before it influences recommendations.
          </p>
          <textarea
            aria-label="Preference memory"
            className="min-h-24 w-full rounded-md border bg-background p-3 text-sm"
            value={memory}
            onChange={(event) => {
              setMemory(event.target.value);
              setMemoryStatus("Unsaved local edits.");
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={saveMemory}>Save memory</Button>
            <Button variant="ghost" onClick={clearMemory}>Clear memory</Button>
            <p className="text-sm text-muted-foreground">{memoryStatus}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Deterministic calculation contract</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-2">
          {AGENT_CALCULATION_SERVICES.map((service) => (
            <div key={service.id} className="rounded-lg border p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{service.label}</p>
                <Badge variant={service.owner === "model" ? "outline" : "secondary"}>
                  {service.owner === "model" ? "model orchestrates" : "service calculates"}
                </Badge>
              </div>
              <p className="mt-1 text-muted-foreground">{service.responsibility}</p>
              <p className="mt-1 text-xs text-muted-foreground">Source: {service.evidence}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedPreview)} onOpenChange={(open) => !open && setPreviewActionId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedPreview?.title ?? "Agent change preview"}</DialogTitle>
          </DialogHeader>
          {selectedPreview && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{selectedPreview.summary}</p>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <p className="text-sm font-semibold">Before</p>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {selectedPreview.before.map((item) => <li key={item}>- {item}</li>)}
                  </ul>
                </div>
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                  <p className="text-sm font-semibold">After preview</p>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {selectedPreview.after.map((item) => <li key={item}>- {item}</li>)}
                  </ul>
                </div>
              </div>
              <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                No {selectedPreview.changeType} changes are applied from this preview. Writes require confirmation in the next step.
              </p>
              <div className="grid gap-3 text-sm md:grid-cols-2">
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="font-semibold">Reason</p>
                  <p className="mt-1 text-muted-foreground">{selectedPreview.reason}</p>
                </div>
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="font-semibold">Confidence</p>
                  <p className="mt-1 capitalize text-muted-foreground">{selectedPreview.confidence}</p>
                </div>
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="font-semibold">Price freshness</p>
                  <p className="mt-1 text-muted-foreground">{selectedPreview.priceFreshness}</p>
                </div>
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="font-semibold">Missing data</p>
                  <ul className="mt-1 space-y-1 text-muted-foreground">
                    {selectedPreview.missingData.map((item) => <li key={item}>- {item}</li>)}
                  </ul>
                </div>
              </div>
              <div className="rounded-lg bg-muted/40 p-3 text-sm">
                <p className="font-semibold">Assumptions</p>
                <ul className="mt-1 space-y-1 text-muted-foreground">
                  {selectedPreview.assumptions.map((item) => <li key={item}>- {item}</li>)}
                </ul>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    scheduleUndoable({ label: "Agent change", onCommit: () => undefined });
                    setPreviewActionId(null);
                  }}
                >
                  Confirm write
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
