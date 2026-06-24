export type AgentTool = {
  id: string;
  label: string;
  domain: "profile" | "logs" | "recipes" | "meal_plans" | "pantry" | "prices" | "specials" | "baskets";
  access: "read" | "write" | "read_write";
  description: string;
  requiresConfirmation: boolean;
};

export const AGENT_TOOLS: AgentTool[] = [
  {
    id: "profile.read",
    label: "Profile",
    domain: "profile",
    access: "read",
    description: "Reads goal, household, dietary, and retailer preferences before planning.",
    requiresConfirmation: false,
  },
  {
    id: "logs.read",
    label: "Logs",
    domain: "logs",
    access: "read",
    description: "Reads meals, water, activity, weight, body fat, and weekly adherence.",
    requiresConfirmation: false,
  },
  {
    id: "recipes.search",
    label: "Recipes",
    domain: "recipes",
    access: "read",
    description: "Finds recipes by macros, cost, time, pantry overlap, and dietary constraints.",
    requiresConfirmation: false,
  },
  {
    id: "meal_plans.preview",
    label: "Meal plans",
    domain: "meal_plans",
    access: "read_write",
    description: "Builds or replans days with nutrition, budget, time, and waste trade-offs.",
    requiresConfirmation: true,
  },
  {
    id: "pantry.read",
    label: "Pantry",
    domain: "pantry",
    access: "read",
    description: "Uses confirmed pantry items, expiry dates, and captured receipts.",
    requiresConfirmation: false,
  },
  {
    id: "prices.compare",
    label: "Retailer prices",
    domain: "prices",
    access: "read",
    description: "Compares observed prices, pack sizes, freshness, and retailer availability.",
    requiresConfirmation: false,
  },
  {
    id: "specials.read",
    label: "Specials",
    domain: "specials",
    access: "read",
    description: "Uses valid offers, loyalty conditions, multibuy details, and freshness.",
    requiresConfirmation: false,
  },
  {
    id: "baskets.preview",
    label: "Baskets",
    domain: "baskets",
    access: "read_write",
    description: "Previews basket substitutions and cost changes before applying them.",
    requiresConfirmation: true,
  },
];

export function toolsForAction(actionId: string) {
  const map: Record<string, string[]> = {
    weekly_plan: ["profile.read", "recipes.search", "meal_plans.preview", "pantry.read", "prices.compare", "specials.read", "baskets.preview"],
    pantry_first: ["pantry.read", "recipes.search", "meal_plans.preview"],
    dinner_swap: ["logs.read", "recipes.search", "meal_plans.preview", "prices.compare"],
    cheaper_basket: ["baskets.preview", "prices.compare", "specials.read", "pantry.read"],
  };
  const ids = new Set(map[actionId] ?? []);
  return AGENT_TOOLS.filter((tool) => ids.has(tool.id));
}
