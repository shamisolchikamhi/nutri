import { useState } from "react";
import { Heart } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const CRAVING_PROFILES = ["sweet", "salty", "chocolate", "creamy", "crunchy", "warm/comforting", "high-volume"];
const SUPPORT_MODES = [
  { id: "original", label: "I want the original food" },
  { id: "pairing", label: "I want a balanced pairing" },
  { id: "substitute", label: "I want a substitute" },
];

export default function CravingsPage() {
  const [profile, setProfile] = useState("chocolate");
  const [intensity, setIntensity] = useState("medium");
  const [hunger, setHunger] = useState("somewhat hungry");
  const [available, setAvailable] = useState("");
  const [budget, setBudget] = useState("");
  const [allergies, setAllergies] = useState("");
  const [mode, setMode] = useState("pairing");

  const selectedMode = SUPPORT_MODES.find((item) => item.id === mode)?.label ?? SUPPORT_MODES[1].label;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Heart className="h-6 w-6 text-primary" /> Craving Assistant
        </h1>
        <p className="text-sm text-muted-foreground">
          Start with what you actually want, then choose whether to keep it, pair it, or find a substitute.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">What are you craving?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {CRAVING_PROFILES.map((item) => (
              <Button
                key={item}
                type="button"
                variant={profile === item ? "default" : "outline"}
                onClick={() => setProfile(item)}
              >
                {item}
              </Button>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Intensity</span>
              <select className="w-full rounded-md border bg-background p-2" value={intensity} onChange={(event) => setIntensity(event.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="strong">Strong</option>
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Hunger</span>
              <select className="w-full rounded-md border bg-background p-2" value={hunger} onChange={(event) => setHunger(event.target.value)}>
                <option value="not hungry">Not hungry</option>
                <option value="somewhat hungry">Somewhat hungry</option>
                <option value="very hungry">Very hungry</option>
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Budget</span>
              <Input aria-label="Budget" placeholder="e.g. R35" value={budget} onChange={(event) => setBudget(event.target.value)} />
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Available ingredients</span>
              <Textarea aria-label="Available ingredients" placeholder="What do you have nearby?" value={available} onChange={(event) => setAvailable(event.target.value)} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Allergies or avoidances</span>
              <Textarea aria-label="Allergies or avoidances" placeholder="Anything to avoid?" value={allergies} onChange={(event) => setAllergies(event.target.value)} />
            </label>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">What kind of help do you want?</p>
            <div className="flex flex-wrap gap-2">
              {SUPPORT_MODES.map((item) => (
                <Button key={item.id} type="button" variant={mode === item.id ? "default" : "outline"} onClick={() => setMode(item.id)}>
                  {item.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Craving brief</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2">
            <Badge>{profile}</Badge>
            <Badge variant="secondary">{intensity} intensity</Badge>
            <Badge variant="secondary">{hunger}</Badge>
            <Badge variant="outline">{selectedMode}</Badge>
          </div>
          <p className="text-muted-foreground">
            Suggestions should be satisfying first, then practical: use available ingredients, stay near {budget || "the chosen budget"}, and respect {allergies || "listed allergies or avoidances"}.
          </p>
          <p className="rounded-lg bg-muted/50 p-3 text-muted-foreground">
            No moral labels, shame language, or failure framing. The assistant treats cravings as useful context, not a problem to punish.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
