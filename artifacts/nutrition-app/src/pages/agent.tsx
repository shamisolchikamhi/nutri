import { useLocation } from "wouter";
import { Bot, CalendarDays, PackagePlus, ShoppingCart, Shuffle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const ACTIONS = [
  {
    title: "Plan my week under R900",
    description: "Build a weekly Goal-to-Cart plan using your budget, household size, pantry, and preferred retailers.",
    route: "/meal-plan",
    icon: CalendarDays,
    inputs: ["budget", "household", "retailers"],
  },
  {
    title: "Use what is in my pantry",
    description: "Prioritize meals that use confirmed pantry items and ingredients expiring soon.",
    route: "/pantry",
    icon: PackagePlus,
    inputs: ["pantry", "expiry", "recipes"],
  },
  {
    title: "Swap tonight's dinner",
    description: "Find a similar recipe that fits remaining calories, protein, time, and budget.",
    route: "/meal-plan",
    icon: Shuffle,
    inputs: ["logs", "recipes", "budget"],
  },
  {
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
    </div>
  );
}
