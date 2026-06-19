import type { ReactNode } from "react";
import { Clock, DollarSign, Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ContentImage } from "./ContentImage";
import { SaveControl } from "./SaveControl";
import { formatMoney } from "@/lib/market";

export type RecipeCardData = {
  id: number;
  name: string;
  imageUrl?: string | null;
  caloriesPerServing: number;
  prepTimeMin?: number | null;
  cookTimeMin?: number | null;
  estimatedCost: number;
  proteinPerServingG?: number;
  carbsPerServingG?: number;
  fatPerServingG?: number;
  difficulty?: string;
  tags?: string[];
  mealTypeLabel?: string;
  isSaved?: boolean;
};

type RecipeCardProps = {
  recipe: RecipeCardData;
  variant?: "grid" | "compact" | "suggestion";
  onOpen?: () => void;
  onSave?: () => void;
  onRemove?: () => void;
  action?: ReactNode;
};

function RecipeMeta({ recipe }: { recipe: RecipeCardData }) {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span className="flex items-center gap-1"><Flame className="h-3 w-3" />{recipe.caloriesPerServing} kcal</span>
      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{(recipe.prepTimeMin ?? 0) + (recipe.cookTimeMin ?? 0)} min</span>
      <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />{formatMoney(recipe.estimatedCost)}</span>
    </div>
  );
}

export function RecipeCard({ recipe, variant = "grid", onOpen, onSave, onRemove, action }: RecipeCardProps) {
  if (variant !== "grid") {
    return (
      <Card className="overflow-hidden transition-shadow hover:shadow-md" onClick={onOpen}>
        <CardContent className="flex p-0">
          <ContentImage src={recipe.imageUrl} kind="recipe" alt={recipe.name} className={variant === "compact" ? "h-24 w-24 flex-shrink-0" : "m-4 mr-0 h-20 w-20 flex-shrink-0 rounded-xl"} />
          <div className="min-w-0 flex-1 p-3">
            {variant === "suggestion" && <Badge variant="secondary" className="mb-1 text-xs">Suggested Meal</Badge>}
            <div className="flex items-start justify-between">
              <h3 className="line-clamp-2 text-sm font-medium leading-tight">{recipe.name}</h3>
              {onRemove && <SaveControl name={recipe.name} saved appearance="inline" onRemove={onRemove} />}
            </div>
            <div className="mt-2"><RecipeMeta recipe={recipe} /></div>
            {action}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="cursor-pointer overflow-hidden transition-shadow hover:shadow-md" onClick={onOpen}>
      <div className="relative">
        <ContentImage src={recipe.imageUrl} kind="recipe" alt={recipe.name} className="h-40 w-full" />
        {(onSave || onRemove) && <SaveControl name={recipe.name} saved={Boolean(recipe.isSaved)} onSave={onSave} onRemove={onRemove} />}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
          <h3 className="text-sm font-semibold leading-tight text-white">{recipe.name}</h3>
        </div>
      </div>
      <CardContent className="space-y-2 p-3">
        <div className="flex flex-wrap gap-1">
          {recipe.mealTypeLabel && <Badge variant="outline" className="py-0 text-xs">{recipe.mealTypeLabel}</Badge>}
          {(recipe.tags ?? []).slice(0, 3).map((tag) => <Badge key={tag} variant="secondary" className="py-0 text-xs">{tag.replace("_", " ")}</Badge>)}
        </div>
        <div className="flex items-center justify-between"><RecipeMeta recipe={recipe} />{recipe.difficulty && <Badge variant="outline" className="py-0 text-xs capitalize">{recipe.difficulty}</Badge>}</div>
        {recipe.proteinPerServingG != null && (
          <div className="flex gap-3 text-xs">
            <span className="font-medium text-emerald-600">P: {recipe.proteinPerServingG}g</span>
            <span className="text-amber-600">C: {recipe.carbsPerServingG}g</span>
            <span className="text-purple-600">F: {recipe.fatPerServingG}g</span>
          </div>
        )}
        {action}
      </CardContent>
    </Card>
  );
}
