import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Check, Clock, PackagePlus, Trash2, Utensils } from "lucide-react";
import { useAppMutation } from "@/hooks/use-app-mutation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageEmpty, PageError } from "@/components/PageState";
import { ConfirmAction } from "@/components/ConfirmAction";

type PantryItem = {
  id: number;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  source: string;
  expiresOn: string | null;
  confirmed: boolean;
};

type PantrySuggestion = {
  recipeId: number;
  name: string;
  matchedPantryItems: string[];
  reason: string;
};

async function apiJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, { ...options, headers: { "Content-Type": "application/json", ...options?.headers } });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string; message?: string } | null;
    throw new Error(body?.error ?? body?.message ?? `Request failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function daysUntil(date: string | null) {
  if (!date) return null;
  const start = new Date();
  const end = new Date(`${date}T00:00:00`);
  return Math.ceil((end.getTime() - start.getTime()) / 86_400_000);
}

function expiryLabel(date: string | null) {
  const days = daysUntil(date);
  if (days == null) return "No expiry";
  if (days < 0) return "Expired";
  if (days === 0) return "Expires today";
  if (days === 1) return "Expires tomorrow";
  return `Expires in ${days} days`;
}

export default function PantryPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [rawText, setRawText] = useState("");
  const [mediaDataUrls, setMediaDataUrls] = useState<string[]>([]);
  const [mediaStatus, setMediaStatus] = useState("");
  const [captureSource, setCaptureSource] = useState<"receipt" | "pantry_photo">("receipt");
  const itemsQuery = useQuery({ queryKey: ["pantry-items"], queryFn: () => apiJson<PantryItem[]>("/pantry/items") });
  const suggestionsQuery = useQuery({ queryKey: ["pantry-suggestions"], queryFn: () => apiJson<PantrySuggestion[]>("/pantry/suggestions") });

  const invalidatePantry = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["pantry-items"] }),
      queryClient.invalidateQueries({ queryKey: ["pantry-suggestions"] }),
    ]);
  };

  const captureMutation = useAppMutation({
    operation: "Capture pantry items",
    reference: "WRITE-PANTRY-CAPTURE",
    successMessage: "Review the extracted items, then confirm anything you want to keep.",
    errorMessage: (error) => error instanceof Error ? error.message : "No pantry items were captured.",
    mutationFn: () => apiJson<{ items: PantryItem[] }>("/pantry/capture", {
      method: "POST",
      body: JSON.stringify({ rawText, mediaDataUrls, source: captureSource }),
    }),
    onSuccess: async () => {
      setRawText("");
      setMediaDataUrls([]);
      setMediaStatus("");
      await invalidatePantry();
    },
  });

  const updateMutation = useAppMutation({
    operation: "Update pantry item",
    reference: "WRITE-PANTRY-ITEM",
    successMessage: false,
    mutationFn: (item: PantryItem) => apiJson<PantryItem>(`/pantry/items/${item.id}`, { method: "PUT", body: JSON.stringify(item) }),
    onSuccess: invalidatePantry,
  });

  const deleteMutation = useAppMutation({
    operation: "Remove pantry item",
    reference: "WRITE-PANTRY-REMOVE",
    successMessage: "The pantry item was removed.",
    mutationFn: (id: number) => fetch(`/api/pantry/items/${id}`, { method: "DELETE" }).then((response) => {
      if (!response.ok) throw new Error(`Request failed with ${response.status}`);
    }),
    onSuccess: invalidatePantry,
  });

  const items = itemsQuery.data ?? [];
  const unconfirmed = items.filter((item) => !item.confirmed);
  const confirmed = items.filter((item) => item.confirmed);

  if (itemsQuery.isLoading) {
    return <div className="space-y-4">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-28" />)}</div>;
  }

  if (itemsQuery.isError) {
    return <PageError reference="DATA-PANTRY" onRetry={() => void itemsQuery.refetch()} isRetrying={itemsQuery.isFetching} />;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><PackagePlus className="h-6 w-6 text-primary" /> Pantry</h1>
        <p className="text-sm text-muted-foreground">Capture receipts or pantry notes, confirm extracted items, and use what expires first.</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Receipt or pantry capture</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2" aria-label="Capture type">
            <Button type="button" variant={captureSource === "receipt" ? "default" : "outline"} onClick={() => setCaptureSource("receipt")}>Receipt</Button>
            <Button type="button" variant={captureSource === "pantry_photo" ? "default" : "outline"} onClick={() => setCaptureSource("pantry_photo")}>Pantry shelf</Button>
          </div>
          <div className="space-y-1">
            <Label htmlFor="pantry-capture">Receipt or pantry text</Label>
            <Textarea
              id="pantry-capture"
              value={rawText}
              onChange={(event) => setRawText(event.target.value)}
              placeholder={"Paste one item per line, for example:\nGreek yoghurt 500g\nBananas x6\nBaby spinach 2026-06-28"}
              className="min-h-32"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pantry-photo">{captureSource === "receipt" ? "Receipt photo" : "Pantry photo"}</Label>
            <Input
              id="pantry-photo"
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={async (event) => {
                const files = Array.from(event.target.files ?? []);
                const dataUrls = await Promise.all(files.filter((file) => file.type.startsWith("image/")).map((file) => new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve(String(reader.result));
                  reader.onerror = () => reject(new Error("Could not read image"));
                  reader.readAsDataURL(file);
                })));
                setMediaDataUrls(dataUrls);
                setMediaStatus(dataUrls.length
                  ? `${dataUrls.length} ${captureSource === "receipt" ? "receipt" : "pantry"} image(s) ready to analyse`
                  : "No readable image selected");
                event.target.value = "";
              }}
            />
            <p className="flex items-center gap-1 text-xs text-muted-foreground"><Camera className="h-3.5 w-3.5" /> {mediaStatus || "On a phone, this opens the rear camera. Photo analysis requires OPENAI_API_KEY."}</p>
          </div>
          <Button onClick={() => captureMutation.mutate()} disabled={captureMutation.isPending || (!rawText.trim() && mediaDataUrls.length === 0)}>
            {captureMutation.isPending ? "Analysing..." : mediaDataUrls.length ? `Analyse ${captureSource === "receipt" ? "receipt" : "pantry photo"}` : "Capture items"}
          </Button>
          {mediaDataUrls.length > 0 && <p className="text-xs text-muted-foreground">Extracted items will wait for your review. Confirm them before they join your inventory.</p>}
        </CardContent>
      </Card>

      {items.length === 0 ? (
        <PageEmpty title="No pantry items yet" description="Capture a receipt or pantry list to start getting expiry-aware meal ideas." action={<Button onClick={() => document.getElementById("pantry-capture")?.focus()}>Capture first items</Button>} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-4">
            {unconfirmed.length > 0 && (
              <section className="space-y-2">
                <h2 className="font-semibold">Review captured items</h2>
                {unconfirmed.map((item) => <PantryItemEditor key={item.id} item={item} onSave={(next) => updateMutation.mutate({ ...next, confirmed: true })} onDelete={(id) => deleteMutation.mutate(id)} />)}
              </section>
            )}
            <section className="space-y-2">
              <h2 className="font-semibold">Inventory</h2>
              {confirmed.length === 0 ? (
                <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Confirm captured items to add them to inventory.</p>
              ) : confirmed.map((item) => <PantryItemEditor key={item.id} item={item} onSave={(next) => updateMutation.mutate(next)} onDelete={(id) => deleteMutation.mutate(id)} />)}
            </section>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><Utensils className="h-4 w-4 text-primary" /> Use first</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {suggestionsQuery.isError ? (
                <PageError reference="DATA-PANTRY-SUGGESTIONS" onRetry={() => void suggestionsQuery.refetch()} isRetrying={suggestionsQuery.isFetching} />
              ) : (suggestionsQuery.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No recipe matches yet. Add or confirm pantry items to unlock expiry-aware suggestions.</p>
              ) : (suggestionsQuery.data ?? []).map((suggestion) => (
                <div key={suggestion.recipeId} className="rounded-xl border p-3">
                  <p className="font-medium">{suggestion.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{suggestion.reason}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {suggestion.matchedPantryItems.map((name) => <Badge key={name} variant="secondary">{name}</Badge>)}
                  </div>
                  <Button className="mt-3" variant="outline" size="sm" onClick={() => setLocation(`/recipes/${suggestion.recipeId}`)}>View recipe</Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function PantryItemEditor({ item, onSave, onDelete }: { item: PantryItem; onSave: (item: PantryItem) => void; onDelete: (id: number) => void }) {
  const [draft, setDraft] = useState(item);
  const days = daysUntil(draft.expiresOn);
  const urgent = days != null && days <= 2;

  return (
    <Card>
      <CardContent className="grid gap-3 p-3 md:grid-cols-[1.5fr_0.7fr_0.7fr_0.9fr_auto]">
        <div className="space-y-1">
          <Label htmlFor={`pantry-name-${item.id}`}>Item</Label>
          <Input id={`pantry-name-${item.id}`} value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`pantry-quantity-${item.id}`}>Qty</Label>
          <Input id={`pantry-quantity-${item.id}`} type="number" min="0" value={draft.quantity} onChange={(event) => setDraft((current) => ({ ...current, quantity: Number(event.target.value) || 1 }))} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`pantry-unit-${item.id}`}>Unit</Label>
          <Input id={`pantry-unit-${item.id}`} value={draft.unit} onChange={(event) => setDraft((current) => ({ ...current, unit: event.target.value }))} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`pantry-expiry-${item.id}`}>Expiry</Label>
          <Input id={`pantry-expiry-${item.id}`} type="date" value={draft.expiresOn ?? ""} onChange={(event) => setDraft((current) => ({ ...current, expiresOn: event.target.value || null }))} />
          <p className={`flex items-center gap-1 text-xs ${urgent ? "text-amber-600" : "text-muted-foreground"}`}><Clock className="h-3 w-3" />{expiryLabel(draft.expiresOn)}</p>
        </div>
        <div className="flex items-end gap-1">
          <Button size="icon" aria-label={item.confirmed ? `Save ${draft.name}` : `Confirm ${draft.name}`} onClick={() => onSave(draft)}>
            <Check className="h-4 w-4" />
          </Button>
          <ConfirmAction title={`Remove ${draft.name}?`} description="This pantry item will be removed from your inventory." onConfirm={() => onDelete(item.id)}>
            <Button size="icon" variant="ghost" aria-label={`Remove ${draft.name}`}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </ConfirmAction>
        </div>
      </CardContent>
    </Card>
  );
}
