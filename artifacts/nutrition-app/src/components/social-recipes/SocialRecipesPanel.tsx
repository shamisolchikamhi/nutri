import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ExternalLink, Upload } from "lucide-react";
import { getListRecipesQueryKey } from "@workspace/api-client-react";
import { BasketAction } from "@/components/content/BasketAction";
import { PageEmpty, PageError } from "@/components/PageState";
import { useAppMutation } from "@/hooks/use-app-mutation";
import { formatMoney } from "@/lib/market";
import { processRecipeMediaFiles } from "./media";

type SocialRecipe = {
  id: number;
  platform: string;
  sourceUrl: string;
  creatorHandle: string | null;
  title: string;
  status: string;
  importedRecipeId: number | null;
  matchedCount: number;
  unmatchedIngredients: string[];
  recipe: { estimatedCost: number } | null;
};

const EMPTY_FORM = {
  sourceUrl: "",
  platform: "auto",
  title: "",
  creatorHandle: "",
  ingredientsText: "",
  caption: "",
  servings: "2",
  marketCode: "ZA",
};

async function apiJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, { ...options, headers: { "Content-Type": "application/json", ...options?.headers } });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string; message?: string } | null;
    throw new Error(body?.error ?? body?.message ?? `Request failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function SocialRecipesPanel() {
  const [, setLocation] = useLocation();
  const [form, setForm] = useState(EMPTY_FORM);
  const [createBasket, setCreateBasket] = useState(true);
  const [mediaDataUrls, setMediaDataUrls] = useState<string[]>([]);
  const [mediaStatus, setMediaStatus] = useState("");
  const query = useQuery({ queryKey: ["social-recipes"], queryFn: () => apiJson<SocialRecipe[]>("/social-recipes") });

  const importMutation = useAppMutation({
    operation: "Import recipe",
    reference: "WRITE-RECIPE-IMPORT",
    successMessage: "The recipe was imported.",
    errorMessage: (error) => error instanceof Error ? error.message : "Nothing was changed. Try again with visible recipe ingredients.",
    invalidate: [getListRecipesQueryKey()],
    mutationFn: () => apiJson<SocialRecipe>("/social-recipes", {
      method: "POST",
      body: JSON.stringify({ ...form, mediaDataUrls, autoExtract: true, platform: form.platform === "auto" ? undefined : form.platform, servings: parseInt(form.servings) || 2 }),
    }),
    onSuccess: async (created) => {
      setForm(EMPTY_FORM);
      setMediaDataUrls([]);
      setMediaStatus("");
      void query.refetch();
      if (createBasket && created.matchedCount > 0) {
        try {
          const basket = await apiJson<{ basketId: number }>(`/social-recipes/${created.id}/basket`, { method: "POST", body: JSON.stringify({ mode: "cheapest" }) });
          setLocation(`/basket/${basket.basketId}`);
        } catch {
          void query.refetch();
        }
      }
    },
  });
  const basketMutation = useAppMutation({
    operation: "Create recipe basket",
    reference: "WRITE-RECIPE-BASKET",
    successMessage: "A basket was created from the recipe.",
    mutationFn: (id: number) => apiJson<{ basketId: number }>(`/social-recipes/${id}/basket`, { method: "POST", body: JSON.stringify({ mode: "cheapest" }) }),
    onSuccess: (basket) => setLocation(`/basket/${basket.basketId}`),
  });
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-4">
          <div><h2 className="font-semibold">Import social recipe</h2><p className="text-sm text-muted-foreground">Paste a public recipe link, or upload screenshots/video so AI can read visible recipe text.</p></div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1 md:col-span-2"><Label htmlFor="social-url">Post URL</Label><Input id="social-url" placeholder="https://www.tiktok.com/@creator/video/..." value={form.sourceUrl} onChange={(event) => update("sourceUrl", event.target.value)} /></div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="social-media">Take a photo or choose recipe media</Label>
              <Input id="social-media" type="file" accept="image/*,video/*" capture="environment" multiple onChange={async (event) => {
                setMediaStatus("Processing uploaded media...");
                try {
                  const frames = await processRecipeMediaFiles(event.target.files);
                  setMediaDataUrls(frames);
                  setMediaStatus(frames.length ? `${frames.length} screenshot/frame(s) ready for AI analysis` : "No readable media frames found");
                } catch (error) {
                  setMediaDataUrls([]);
                  setMediaStatus(error instanceof Error ? error.message : "Could not process uploaded media");
                } finally { event.target.value = ""; }
              }} />
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Upload className="h-3.5 w-3.5" /><span>{mediaStatus || "On a phone, open the camera or choose screenshots and saved recipe video."}</span></div>
            </div>
            <div className="space-y-1"><Label htmlFor="social-title">Title</Label><Input id="social-title" placeholder="High protein chicken bowl" value={form.title} onChange={(event) => update("title", event.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="social-creator">Creator</Label><Input id="social-creator" placeholder="@creator" value={form.creatorHandle} onChange={(event) => update("creatorHandle", event.target.value)} /></div>
            <div className="space-y-1"><Label>Platform</Label><Select value={form.platform} onValueChange={(value) => update("platform", value)}><SelectTrigger aria-label="Platform"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="auto">Auto detect</SelectItem><SelectItem value="tiktok">TikTok</SelectItem><SelectItem value="instagram">Instagram</SelectItem><SelectItem value="facebook">Facebook</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div>
            <div className="space-y-1"><Label htmlFor="social-servings">Servings</Label><Input id="social-servings" type="number" min="1" value={form.servings} onChange={(event) => update("servings", event.target.value)} /></div>
            <div className="space-y-1 md:col-span-2"><Label htmlFor="social-ingredients">Ingredients</Label><Textarea id="social-ingredients" placeholder={"Optional hint if the post is hard to read:\n1 cup oats\n2 bananas\n200g yoghurt"} value={form.ingredientsText} onChange={(event) => update("ingredientsText", event.target.value)} className="min-h-28" /></div>
            <div className="space-y-1 md:col-span-2"><Label htmlFor="social-caption">Caption or notes</Label><Textarea id="social-caption" placeholder="Optional caption, method, or notes from the post" value={form.caption} onChange={(event) => update("caption", event.target.value)} className="min-h-20" /></div>
          </div>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={createBasket} onCheckedChange={(checked) => setCreateBasket(checked === true)} />Create a grocery basket from matched local-store ingredients</label>
          <Button onClick={() => importMutation.mutate()} disabled={importMutation.isPending || !(form.sourceUrl || mediaDataUrls.length)}>{importMutation.isPending ? "Analyzing recipe..." : "Analyze recipe and match local products"}</Button>
        </CardContent>
      </Card>

      {query.isLoading ? <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{[1, 2].map((id) => <Skeleton key={id} className="h-44 rounded-xl" />)}</div>
        : query.isError ? <PageError reference="DATA-SOCIAL-RECIPES" onRetry={() => void query.refetch()} isRetrying={query.isFetching} />
        : !query.data?.length ? <PageEmpty title="No social recipes imported yet" description="Add a public post URL or upload visible recipe media before importing." action={<Button onClick={() => document.getElementById("social-url")?.focus()}>Add recipe source</Button>} />
        : <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{query.data.map((item) => (
          <Card key={item.id}><CardContent className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-3"><div><div className="mb-1 flex items-center gap-2"><Badge variant="secondary" className="capitalize">{item.platform}</Badge><Badge variant={item.status === "needs_review" ? "outline" : "default"} className="capitalize">{item.status.replace("_", " ")}</Badge></div><h3 className="font-semibold leading-tight">{item.title}</h3>{item.creatorHandle && <p className="text-xs text-muted-foreground">{item.creatorHandle}</p>}</div><a href={item.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Open ${item.title} source`} className="text-muted-foreground hover:text-primary"><ExternalLink className="h-4 w-4" /></a></div>
            <div className="grid grid-cols-3 gap-2 text-center text-sm"><div className="rounded-lg bg-muted/50 p-2"><p className="font-bold">{item.matchedCount}</p><p className="text-xs text-muted-foreground">matched</p></div><div className="rounded-lg bg-muted/50 p-2"><p className="font-bold">{item.unmatchedIngredients.length}</p><p className="text-xs text-muted-foreground">review</p></div><div className="rounded-lg bg-muted/50 p-2"><p className="font-bold">{item.recipe ? formatMoney(item.recipe.estimatedCost) : "-"}</p><p className="text-xs text-muted-foreground">basket est.</p></div></div>
            {item.unmatchedIngredients.length > 0 && <p className="text-xs text-amber-700">Needs match: {item.unmatchedIngredients.slice(0, 4).join(", ")}</p>}
            <div className="flex gap-2">{item.importedRecipeId && <Button variant="outline" size="sm" onClick={() => setLocation(`/recipes/${item.importedRecipeId}`)}>View recipe</Button>}<BasketAction onClick={() => basketMutation.mutate(item.id)} disabled={item.matchedCount === 0} pending={basketMutation.isPending} /></div>
          </CardContent></Card>
        ))}</div>}
    </div>
  );
}
