import { useLocation } from "wouter";
import { Bot, CalendarDays, PackagePlus, ShoppingCart, Shuffle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AGENT_CALCULATION_SERVICES, calculationServicesForAction } from "@/lib/agent-calculations";
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

export default function AgentPage() {
  const [, setLocation] = useLocation();

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
              <Button variant="outline" onClick={() => setLocation(action.route)}>
                Start action
              </Button>
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
    </div>
  );
}
