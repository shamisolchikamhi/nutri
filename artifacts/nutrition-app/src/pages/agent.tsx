import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Bot, CalendarDays, PackagePlus, Send, Settings2, ShieldCheck, ShoppingCart, Shuffle, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { previewForAction } from "@/lib/agent-previews";
import { AGENT_SAFETY_BOUNDARIES } from "@/lib/agent-safety";

const SUGGESTIONS = [
  { id: "weekly_plan", label: "Plan my week under R900", route: "/meal-plan", icon: CalendarDays },
  { id: "pantry_first", label: "Use what is in my pantry", route: "/meal-plan", icon: PackagePlus },
  { id: "dinner_swap", label: "Swap tonight's dinner", route: "/meal-plan", icon: Shuffle },
  { id: "cheaper_basket", label: "Make my basket cheaper", route: "/basket", icon: ShoppingCart },
] as const;

type Suggestion = (typeof SUGGESTIONS)[number];
type Message = { id: number; role: "user" | "assistant"; text: string; action?: Suggestion };

const AGENT_MEMORY_KEY = "nutribasket.agent.preferenceMemory";
const DEFAULT_MEMORY = "Prefers budget-aware, high-protein plans with pantry-first swaps and visible price trade-offs.";

function responseFor(action: Suggestion) {
  if (action.id === "weekly_plan") return "I can build that around your nutrition target, confirmed pantry items, cooking time, and preferred shops. You can swap any meal before accepting the plan.";
  if (action.id === "pantry_first") return "I’ll start with confirmed pantry items, prioritise ingredients expiring soon, and put only missing ingredients on the shopping list.";
  if (action.id === "dinner_swap") return "I’ll find a similar dinner that fits today’s remaining nutrition, your pantry, time, and budget. Nothing changes until you choose the swap.";
  return "I’ll compare matching products and current specials, then show the cheaper basket before you make a change.";
}

function matchSuggestion(input: string) {
  const normalized = input.toLowerCase();
  if (/pantry|have at home|inventory/.test(normalized)) return SUGGESTIONS[1];
  if (/swap|dinner|replace meal/.test(normalized)) return SUGGESTIONS[2];
  if (/basket|cheaper|special|shop/.test(normalized)) return SUGGESTIONS[3];
  return SUGGESTIONS[0];
}

export default function AgentPage() {
  const [, setLocation] = useLocation();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([{
    id: 1,
    role: "assistant",
    text: "What would you like help with? Ask naturally, or choose one of the suggestions below.",
  }]);
  const [previewActionId, setPreviewActionId] = useState<string | null>(null);
  const [memory, setMemory] = useState(DEFAULT_MEMORY);
  const [memoryStatus, setMemoryStatus] = useState("Stored locally. Edit or clear this any time.");
  const selectedPreview = previewActionId ? previewForAction(previewActionId) : undefined;

  useEffect(() => {
    const stored = window.localStorage.getItem(AGENT_MEMORY_KEY);
    if (stored != null) setMemory(stored);
  }, []);

  function ask(text: string, suggestion?: Suggestion) {
    const question = text.trim();
    if (!question) return;
    const action = suggestion ?? matchSuggestion(question);
    setMessages((current) => [
      ...current,
      { id: Date.now(), role: "user", text: question },
      { id: Date.now() + 1, role: "assistant", text: responseFor(action), action },
    ]);
    setInput("");
  }

  function saveMemory() {
    window.localStorage.setItem(AGENT_MEMORY_KEY, memory.trim());
    setMemoryStatus("Preferences saved.");
  }

  function clearMemory() {
    window.localStorage.removeItem(AGENT_MEMORY_KEY);
    setMemory("");
    setMemoryStatus("Preferences cleared.");
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-3xl flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Bot className="h-6 w-6 text-primary" /> Nutri Agent</h1>
          <p className="text-sm text-muted-foreground">Chat about meals, pantry items, plans, and shopping.</p>
        </div>
        <Dialog>
          <DialogTrigger asChild><Button size="sm" variant="ghost"><Settings2 className="mr-1 h-4 w-4" /> Preferences</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Agent preferences</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">These notes help tailor future suggestions and stay visible to you.</p>
            <textarea aria-label="Preference memory" className="min-h-28 w-full rounded-md border bg-background p-3 text-sm" value={memory} onChange={(event) => { setMemory(event.target.value); setMemoryStatus("Unsaved edits."); }} />
            <p className="text-sm text-muted-foreground">{memoryStatus}</p>
            <DialogFooter><Button variant="ghost" onClick={clearMemory}>Clear</Button><Button onClick={saveMemory}>Save preferences</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="flex-1">
        <CardContent className="flex min-h-[430px] flex-col p-4">
          <div className="flex-1 space-y-4" aria-live="polite">
            {messages.map((message) => (
              <div key={message.id} className={`flex gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                {message.role === "assistant" && <div className="mt-1 rounded-full bg-primary/10 p-2 text-primary"><Bot className="h-4 w-4" /></div>}
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  <p>{message.text}</p>
                  {message.action && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" className="bg-background text-foreground" onClick={() => setPreviewActionId(message.action!.id)}>Preview</Button>
                      <Button size="sm" onClick={() => setLocation(message.action!.route)}>Continue</Button>
                    </div>
                  )}
                </div>
                {message.role === "user" && <div className="mt-1 rounded-full bg-muted p-2"><User className="h-4 w-4" /></div>}
              </div>
            ))}
          </div>

          <div className="mt-5 space-y-3 border-t pt-4">
            <p className="text-xs font-medium text-muted-foreground">Suggested questions</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <Button key={suggestion.id} size="sm" variant="outline" className="h-auto whitespace-normal text-left" onClick={() => ask(suggestion.label, suggestion)}>
                  <suggestion.icon className="mr-1.5 h-3.5 w-3.5 shrink-0" /> {suggestion.label}
                </Button>
              ))}
            </div>
            <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); ask(input); }}>
              <Input aria-label="Message Nutri Agent" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about your meals, pantry, or budget..." />
              <Button type="submit" size="icon" aria-label="Send message" disabled={!input.trim()}><Send className="h-4 w-4" /></Button>
            </form>
          </div>
        </CardContent>
      </Card>

      <div className="text-center text-xs text-muted-foreground">
        By using Nutri Agent you agree to the{" "}
        <Dialog>
          <DialogTrigger asChild><button className="underline underline-offset-2">terms and safety conditions</button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nutri Agent terms and safety conditions</DialogTitle></DialogHeader>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>Nutri Agent provides planning and educational support, not medical diagnosis or treatment. Nutrition and price values may be estimates and should be reviewed before use.</p>
              {AGENT_SAFETY_BOUNDARIES.map((boundary) => <p key={boundary.id}><span className="font-medium text-foreground">{boundary.title}:</span> {boundary.rule}</p>)}
              <p>Changes to plans, profiles, logs, and baskets are shown for review before they are applied.</p>
            </div>
            <DialogFooter><Button><ShieldCheck className="mr-1 h-4 w-4" /> I understand</Button></DialogFooter>
          </DialogContent>
        </Dialog>.
      </div>

      <Dialog open={Boolean(selectedPreview)} onOpenChange={(open) => !open && setPreviewActionId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{selectedPreview?.title ?? "Preview"}</DialogTitle></DialogHeader>
          {selectedPreview && <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">{selectedPreview.summary}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border p-3"><p className="font-semibold">Current</p>{selectedPreview.before.map((item) => <p className="mt-1 text-muted-foreground" key={item}>- {item}</p>)}</div>
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3"><p className="font-semibold">Suggested</p>{selectedPreview.after.map((item) => <p className="mt-1 text-muted-foreground" key={item}>- {item}</p>)}</div>
            </div>
            <p className="text-xs text-muted-foreground">Reason: {selectedPreview.reason} Confidence: {selectedPreview.confidence}. Prices: {selectedPreview.priceFreshness}.</p>
            <DialogFooter><Button variant="outline" onClick={() => setPreviewActionId(null)}>Back to chat</Button><Button onClick={() => { const action = SUGGESTIONS.find((item) => item.id === previewActionId); if (action) setLocation(action.route); }}>Continue</Button></DialogFooter>
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
