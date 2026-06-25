export type AgentCalculationService = {
  id: string;
  label: string;
  owner: "deterministic_service" | "model";
  responsibility: string;
  evidence: string;
};

export const AGENT_CALCULATION_SERVICES: AgentCalculationService[] = [
  {
    id: "nutrition-targets",
    label: "Nutrition totals",
    owner: "deterministic_service",
    responsibility: "Calculate calories, protein, carbs, fat, hydration, and remaining daily targets.",
    evidence: "Shared nutrition library and dashboard/log totals.",
  },
  {
    id: "basket-pricing",
    label: "Basket pricing",
    owner: "deterministic_service",
    responsibility: "Calculate pack quantities, effective prices, retailer comparisons, specials savings, and basket totals.",
    evidence: "Basket service, ingredient matching, retailer prices, and specials data.",
  },
  {
    id: "value-score",
    label: "Value scoring",
    owner: "deterministic_service",
    responsibility: "Rank product value from normalized price, protein, fibre, goal fit, pack size, and observed savings.",
    evidence: "Transparent value-score breakdown shown on products and specials.",
  },
  {
    id: "intent-orchestration",
    label: "Intent and explanation",
    owner: "model",
    responsibility: "Interpret the user request, choose tools, compare valid options, and explain trade-offs.",
    evidence: "The model does not invent totals or prices; it cites service outputs and missing data.",
  },
];

export function calculationServicesForAction(actionId: string) {
  const map: Record<string, string[]> = {
    weekly_plan: ["nutrition-targets", "basket-pricing", "value-score", "intent-orchestration"],
    pantry_first: ["nutrition-targets", "basket-pricing", "intent-orchestration"],
    dinner_swap: ["nutrition-targets", "value-score", "intent-orchestration"],
    cheaper_basket: ["basket-pricing", "value-score", "intent-orchestration"],
  };
  const ids = new Set(map[actionId] ?? []);
  return AGENT_CALCULATION_SERVICES.filter((service) => ids.has(service.id));
}
