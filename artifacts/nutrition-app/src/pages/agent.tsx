import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Bot, Check, LoaderCircle, Send, Settings2, ShieldCheck, Undo2, User, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AGENT_SAFETY_BOUNDARIES } from "@/lib/agent-safety";

type AgentProposal = {
  id: number;
  kind: string;
  summary: string;
  payload: Record<string, unknown>;
  expiresAt: string;
  status?: "pending" | "confirmed" | "dismissed" | "undone" | "failed";
  result?: { route?: string; [key: string]: unknown };
};

type Message = {
  id: number;
  role: "user" | "assistant";
  content: string;
  source?: "deterministic" | "openai";
  followUpQuestions?: string[];
  proposals?: AgentProposal[];
};

type ChatResponse = {
  message: string;
  source: "deterministic" | "openai";
  followUpQuestions: string[];
  proposals: AgentProposal[];
};

const SUGGESTIONS = [
  "Plan my week under R900",
  "Use what is in my pantry",
  "Log 500 ml water",
  "Add 6 eggs to my pantry",
  "Log my weight as 80 kg",
  "Swap tonight's dinner",
];

const AGENT_MEMORY_KEY = "nutribasket.agent.preferenceMemory";
const AGENT_CHAT_KEY = "nutribasket.agent.sessionMessages";
const DEFAULT_MEMORY = "Prefers budget-aware, high-protein plans with pantry-first swaps and visible price trade-offs.";
const INITIAL_MESSAGE: Message = { id: 1, role: "assistant", content: "What would you like help with? I can answer questions and prepare app entries for you to review." };
const READ_ONLY_FIELDS = new Set(["recipeId", "productId", "nutritionSource", "servingAssumption"]);

async function apiJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, { ...options, headers: { "Content-Type": "application/json", ...options?.headers } });
  const body = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) throw new Error(body?.error ?? `Request failed with ${response.status}`);
  return body as T;
}

function friendlyFieldName(value: string) {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}

export default function AgentPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const endRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [retryText, setRetryText] = useState("");
  const [memory, setMemory] = useState(DEFAULT_MEMORY);
  const [memoryStatus, setMemoryStatus] = useState("Stored locally. Edit or clear this any time.");

  useEffect(() => {
    const storedMemory = window.localStorage.getItem(AGENT_MEMORY_KEY);
    if (storedMemory != null) setMemory(storedMemory);
    const storedMessages = window.sessionStorage.getItem(AGENT_CHAT_KEY);
    if (storedMessages) {
      try {
        const parsed = JSON.parse(storedMessages) as Message[];
        if (Array.isArray(parsed) && parsed.length > 0) setMessages(parsed);
      } catch {
        window.sessionStorage.removeItem(AGENT_CHAT_KEY);
      }
    }
  }, []);

  useEffect(() => {
    window.sessionStorage.setItem(AGENT_CHAT_KEY, JSON.stringify(messages));
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  function updateProposal(messageId: number, proposalId: number, change: (proposal: AgentProposal) => AgentProposal) {
    setMessages((current) => current.map((message) => message.id !== messageId ? message : {
      ...message,
      proposals: message.proposals?.map((proposal) => proposal.id === proposalId ? change(proposal) : proposal),
    }));
  }

  async function ask(text: string) {
    const question = text.trim();
    if (!question || sending) return;
    const userMessage: Message = { id: Date.now(), role: "user", content: question };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setSending(true);
    setError("");
    setRetryText(question);
    try {
      const response = await apiJson<ChatResponse>("/agent/chat", {
        method: "POST",
        body: JSON.stringify({ messages: nextMessages.map(({ role, content }) => ({ role, content })) }),
      });
      setMessages((current) => [...current, {
        id: Date.now() + 1,
        role: "assistant",
        content: response.message,
        source: response.source,
        followUpQuestions: response.followUpQuestions,
        proposals: response.proposals.map((proposal) => ({ ...proposal, status: "pending" })),
      }]);
      setInput("");
      setRetryText("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nutri Agent could not respond.");
    } finally {
      setSending(false);
    }
  }

  async function saveEditedProposal(messageId: number, proposal: AgentProposal) {
    try {
      const updated = await apiJson<AgentProposal>(`/agent/actions/${proposal.id}`, { method: "PUT", body: JSON.stringify({ payload: proposal.payload }) });
      updateProposal(messageId, proposal.id, () => ({ ...updated, status: "pending" }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The preview could not be edited.");
    }
  }

  async function confirmProposal(messageId: number, proposal: AgentProposal) {
    try {
      const response = await apiJson<{ status: string; result?: AgentProposal["result"] }>(`/agent/actions/${proposal.id}/confirm`, { method: "POST" });
      updateProposal(messageId, proposal.id, (current) => ({ ...current, status: "confirmed", result: response.result }));
      await queryClient.invalidateQueries();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The action could not be confirmed.");
    }
  }

  async function dismissProposal(messageId: number, proposal: AgentProposal) {
    try {
      await apiJson(`/agent/actions/${proposal.id}/dismiss`, { method: "POST" });
      updateProposal(messageId, proposal.id, (current) => ({ ...current, status: "dismissed" }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The action could not be dismissed.");
    }
  }

  async function undoProposal(messageId: number, proposal: AgentProposal) {
    try {
      await apiJson(`/agent/actions/${proposal.id}/undo`, { method: "POST" });
      updateProposal(messageId, proposal.id, (current) => ({ ...current, status: "undone" }));
      await queryClient.invalidateQueries();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The action could not be undone.");
    }
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
          <p className="text-sm text-muted-foreground">Ask questions or prepare meals, water, activity, pantry, profile, plan, and shopping entries.</p>
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
        <CardContent className="flex min-h-[500px] flex-col p-4">
          <div className="flex-1 space-y-4" aria-live="polite">
            {messages.map((message) => (
              <div key={message.id} className={`flex gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                {message.role === "assistant" && <div className="mt-1 h-fit rounded-full bg-primary/10 p-2 text-primary"><Bot className="h-4 w-4" /></div>}
                <div className={`max-w-[90%] space-y-3 rounded-2xl px-4 py-3 text-sm ${message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  <p>{message.content}</p>
                  {message.source && <Badge variant="outline" className="bg-background text-[10px]">{message.source === "openai" ? "AI assisted" : "Local parser"}</Badge>}
                  {message.followUpQuestions?.map((question) => <button key={question} className="block text-left text-xs font-medium text-primary underline-offset-2 hover:underline" onClick={() => setInput(question)}>{question}</button>)}
                  {message.proposals?.map((proposal) => (
                    <ProposalCard
                      key={proposal.id}
                      proposal={proposal}
                      onChange={(next) => updateProposal(message.id, proposal.id, () => next)}
                      onSave={() => saveEditedProposal(message.id, proposal)}
                      onConfirm={() => confirmProposal(message.id, proposal)}
                      onDismiss={() => dismissProposal(message.id, proposal)}
                      onUndo={() => undoProposal(message.id, proposal)}
                      onOpen={() => proposal.result?.route && setLocation(proposal.result.route)}
                    />
                  ))}
                </div>
                {message.role === "user" && <div className="mt-1 h-fit rounded-full bg-muted p-2"><User className="h-4 w-4" /></div>}
              </div>
            ))}
            {sending && <div className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" /> Nutri Agent is working...</div>}
            <div ref={endRef} />
          </div>

          <div className="mt-5 space-y-3 border-t pt-4">
            {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"><span>{error}</span>{retryText && <Button size="sm" variant="outline" onClick={() => ask(retryText)}>Retry</Button>}</div>}
            <p className="text-xs font-medium text-muted-foreground">Suggested questions</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((suggestion) => <Button key={suggestion} size="sm" variant="outline" className="h-auto whitespace-normal text-left" onClick={() => ask(suggestion)}>{suggestion}</Button>)}
            </div>
            <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); ask(input); }}>
              <Input aria-label="Message Nutri Agent" value={input} onChange={(event) => setInput(event.target.value)} placeholder="e.g. Add 6 eggs to my pantry" />
              <Button type="submit" size="icon" aria-label="Send message" disabled={!input.trim() || sending}><Send className="h-4 w-4" /></Button>
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
              <p>Every app change is shown for review and requires confirmation.</p>
            </div>
            <DialogFooter><Button><ShieldCheck className="mr-1 h-4 w-4" /> I understand</Button></DialogFooter>
          </DialogContent>
        </Dialog>.
      </div>
    </div>
  );
}

function ProposalCard({ proposal, onChange, onSave, onConfirm, onDismiss, onUndo, onOpen }: {
  proposal: AgentProposal;
  onChange: (proposal: AgentProposal) => void;
  onSave: () => void;
  onConfirm: () => void;
  onDismiss: () => void;
  onUndo: () => void;
  onOpen: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const pending = !proposal.status || proposal.status === "pending";
  return (
    <div className="space-y-3 rounded-xl border bg-background p-3 text-foreground">
      <div className="flex items-start justify-between gap-2">
        <div><p className="font-semibold">Review app change</p><p className="text-xs text-muted-foreground">{proposal.summary}</p></div>
        <Badge variant={proposal.status === "confirmed" ? "secondary" : "outline"}>{proposal.status ?? "pending"}</Badge>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {Object.entries(proposal.payload).filter(([, value]) => value != null).map(([key, value]) => (
          <label key={key} className="space-y-1 text-xs">
            <span className="text-muted-foreground">{friendlyFieldName(key)}</span>
            {editing && !READ_ONLY_FIELDS.has(key) && !Array.isArray(value) ? (
              <Input
                aria-label={friendlyFieldName(key)}
                className="h-8"
                value={String(value)}
                onChange={(event) => onChange({ ...proposal, payload: { ...proposal.payload, [key]: typeof value === "number" ? Number(event.target.value) : event.target.value } })}
              />
            ) : <p className="font-medium">{Array.isArray(value) ? value.join(", ") : String(value)}</p>}
          </label>
        ))}
      </div>
      {pending && <div className="flex flex-wrap gap-2">
        {editing ? <Button size="sm" variant="outline" onClick={() => { onSave(); setEditing(false); }}>Save edit</Button> : <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit</Button>}
        <Button size="sm" onClick={onConfirm}><Check className="mr-1 h-3.5 w-3.5" /> Confirm</Button>
        <Button size="sm" variant="ghost" onClick={onDismiss}><X className="mr-1 h-3.5 w-3.5" /> Dismiss</Button>
      </div>}
      {proposal.status === "confirmed" && <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={onUndo}><Undo2 className="mr-1 h-3.5 w-3.5" /> Undo</Button>{proposal.result?.route && <Button size="sm" onClick={onOpen}>Open saved entry</Button>}</div>}
      {proposal.status === "undone" && <p className="text-xs text-muted-foreground">This change was undone.</p>}
      {proposal.status === "dismissed" && <p className="text-xs text-muted-foreground">This suggestion was dismissed without changing the app.</p>}
    </div>
  );
}
