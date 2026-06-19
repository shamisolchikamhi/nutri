import { useState } from "react";
import { useLocation } from "wouter";
import { useAppMutation } from "@/hooks/use-app-mutation";
import {
  useListBaskets,
  createBasket,
  deleteBasket,
  getListBasketsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingCart, Plus, Trash2, ChevronRight } from "lucide-react";
import { formatMoney } from "@/lib/market";
import { PageEmpty, PageError } from "@/components/PageState";
import { ConfirmAction } from "@/components/ConfirmAction";
import { useUndoableAction } from "@/hooks/use-undoable-action";

export default function BasketPage() {
  const scheduleUndoable = useUndoableAction();
  const [, setLocation] = useLocation();
  const basketsQuery = useListBaskets();
  const { data: baskets, isLoading } = basketsQuery;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"cheapest" | "healthiest" | "highest_protein" | "lowest_calorie" | "budget">("cheapest");

  const createMutation = useAppMutation({
    operation: "Create basket",
    reference: "WRITE-BASKET-CREATE",
    successMessage: "Your basket was created.",
    invalidate: [getListBasketsQueryKey()],
    mutationFn: () => createBasket({ name: name || "My Basket", mode }),
    onSuccess: (basket) => {
      setOpen(false);
      setName("");
      setLocation(`/basket/${basket.id}`);
    },
  });

  const deleteMutation = useAppMutation({
    operation: "Delete basket",
    reference: "WRITE-BASKET-DELETE",
    successMessage: "The basket was deleted.",
    invalidate: [getListBasketsQueryKey()],
    mutationFn: (id: number) => deleteBasket(id),
  });

  if (isLoading) return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20" />)}</div>;
  if (basketsQuery.isError) return <PageError reference="DATA-BASKETS" onRetry={() => void basketsQuery.refetch()} isRetrying={basketsQuery.isFetching} />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Baskets</h1>
          <p className="text-muted-foreground text-sm">Smart grocery planning across retailers</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> New Basket</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Basket</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Basket Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Weekly Shop" />
              </div>
              <div className="space-y-1">
                <Label>Shopping Mode</Label>
                <Select value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cheapest">Cheapest Overall</SelectItem>
                    <SelectItem value="healthiest">Healthiest</SelectItem>
                    <SelectItem value="highest_protein">Highest Protein</SelectItem>
                    <SelectItem value="lowest_calorie">Lowest Calorie</SelectItem>
                    <SelectItem value="budget">Budget</SelectItem>
                    <SelectItem value="single_retailer">Single Retailer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create Basket"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {(baskets ?? []).length === 0 ? (
        <PageEmpty title="No baskets yet" description="Create a basket before comparing your grocery shop." action={<Button onClick={() => setOpen(true)}>Create your first basket</Button>} />
      ) : (
        <div className="space-y-3">
          {(baskets ?? []).map((basket) => (
            <Card key={basket.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setLocation(`/basket/${basket.id}`)}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <ShoppingCart className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-semibold">{basket.name}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{basket.itemCount} items</span>
                      <span>·</span>
                      <span className="font-medium text-primary">{formatMoney(basket.totalCost)}</span>
                      <Badge variant="outline" className="text-xs capitalize py-0">{basket.mode.replace("_", " ")}</Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ConfirmAction
                    title={`Delete ${basket.name}?`}
                    description="This basket and its items will be deleted."
                    onConfirm={() => scheduleUndoable({ label: "Basket deletion", onCommit: () => deleteMutation.mutate(basket.id) })}
                  >
                    <button aria-label={`Delete ${basket.name}`} onClick={(event) => event.stopPropagation()} className="h-8 w-8 rounded-lg hover:bg-destructive/10 hover:text-destructive flex items-center justify-center transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </ConfirmAction>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Tips */}
      <Card className="bg-emerald-50 border-emerald-200">
        <CardContent className="p-4">
          <p className="text-sm font-medium text-emerald-800 mb-1">💡 Pro Tips</p>
          <ul className="text-xs text-emerald-700 space-y-1">
            <li>• Use "Cheapest Overall" to compare prices across supported retailers in your market</li>
            <li>• Create a basket from a recipe to automatically add all ingredients</li>
            <li>• "Specials Only" mode highlights best value buys this week</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
