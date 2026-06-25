export type AgentPreview = {
  actionId: string;
  title: string;
  changeType: "plan" | "log" | "profile" | "basket";
  summary: string;
  before: string[];
  after: string[];
  requiresConfirmation: boolean;
};

export const AGENT_PREVIEWS: AgentPreview[] = [
  {
    actionId: "weekly_plan",
    title: "Weekly plan preview",
    changeType: "plan",
    summary: "Rebuild the week with budget, protein, pantry overlap, and retailer availability checked first.",
    before: ["Current plan stays unchanged", "No basket is created", "Pantry items are only read"],
    after: ["7-day draft plan under R900", "Basket estimate with retailer comparison", "Pantry-first swaps highlighted"],
    requiresConfirmation: true,
  },
  {
    actionId: "pantry_first",
    title: "Pantry-first preview",
    changeType: "plan",
    summary: "Suggest meals that use confirmed pantry items and expiry dates before proposing new groceries.",
    before: ["Existing pantry quantities remain unchanged", "Current meals remain in place"],
    after: ["Meal suggestions ranked by expiry risk", "Shopping list reduced by pantry matches", "Waste-risk notes added to the plan"],
    requiresConfirmation: true,
  },
  {
    actionId: "dinner_swap",
    title: "Dinner swap preview",
    changeType: "log",
    summary: "Compare tonight's logged meal against a candidate swap using remaining calories, protein, time, and budget.",
    before: ["Tonight's meal log is kept", "Daily totals are unchanged"],
    after: ["Candidate dinner with macro delta", "Updated day totals preview", "Reason for the recommended swap"],
    requiresConfirmation: true,
  },
  {
    actionId: "cheaper_basket",
    title: "Cheaper basket preview",
    changeType: "basket",
    summary: "Preview retailer and product substitutions before changing basket contents.",
    before: ["Current basket items and quantities stay unchanged", "Saved retailer preference is preserved"],
    after: ["Lower-cost substitutions grouped by retailer", "Price and protein delta per swap", "Freshness and price-age warnings"],
    requiresConfirmation: true,
  },
];

export function previewForAction(actionId: string) {
  return AGENT_PREVIEWS.find((preview) => preview.actionId === actionId);
}
