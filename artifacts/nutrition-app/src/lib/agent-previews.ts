export type AgentPreview = {
  actionId: string;
  title: string;
  changeType: "plan" | "log" | "profile" | "basket";
  summary: string;
  before: string[];
  after: string[];
  assumptions: string[];
  missingData: string[];
  confidence: "low" | "medium" | "high";
  priceFreshness: string;
  reason: string;
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
    assumptions: ["Household size and retailer preferences come from the active profile", "Pantry quantities are trusted only when confirmed"],
    missingData: ["Recent appetite or energy notes", "Any meals eaten away from home"],
    confidence: "medium",
    priceFreshness: "Uses the latest observed retailer prices and flags stale or estimated prices.",
    reason: "Keeps the plan inside budget while protecting protein and reducing duplicate fresh ingredients.",
    requiresConfirmation: true,
  },
  {
    actionId: "pantry_first",
    title: "Pantry-first preview",
    changeType: "plan",
    summary: "Suggest meals that use confirmed pantry items and expiry dates before proposing new groceries.",
    before: ["Existing pantry quantities remain unchanged", "Current meals remain in place"],
    after: ["Meal suggestions ranked by expiry risk", "Shopping list reduced by pantry matches", "Waste-risk notes added to the plan"],
    assumptions: ["Receipt-captured pantry items still exist unless marked used", "Soonest expiry receives the strongest ranking boost"],
    missingData: ["Opened dates for shelf-stable items"],
    confidence: "medium",
    priceFreshness: "Only new grocery gaps use retailer prices; pantry-owned items are treated as already paid for.",
    reason: "Uses food already available first, then fills nutrition gaps with the smallest realistic basket.",
    requiresConfirmation: true,
  },
  {
    actionId: "dinner_swap",
    title: "Dinner swap preview",
    changeType: "log",
    summary: "Compare tonight's logged meal against a candidate swap using remaining calories, protein, time, and budget.",
    before: ["Tonight's meal log is kept", "Daily totals are unchanged"],
    after: ["Candidate dinner with macro delta", "Updated day totals preview", "Reason for the recommended swap"],
    assumptions: ["Remaining macros come from today's logged meals and activity", "Recipe servings match the selected household serving size"],
    missingData: ["Hunger level and exact dinner prep time"],
    confidence: "high",
    priceFreshness: "Recipe cost uses matched products; any unmatched ingredient is labelled as estimated.",
    reason: "Preserves dinner intent while improving the day's remaining protein, calorie, and cost fit.",
    requiresConfirmation: true,
  },
  {
    actionId: "cheaper_basket",
    title: "Cheaper basket preview",
    changeType: "basket",
    summary: "Preview retailer and product substitutions before changing basket contents.",
    before: ["Current basket items and quantities stay unchanged", "Saved retailer preference is preserved"],
    after: ["Lower-cost substitutions grouped by retailer", "Price and protein delta per swap", "Freshness and price-age warnings"],
    assumptions: ["Equivalent products are matched by ingredient category, pack unit, and product name similarity", "Pack quantities are rounded up to avoid under-buying"],
    missingData: ["In-store stock and delivery fees"],
    confidence: "medium",
    priceFreshness: "Each swap includes observed, estimated, or stale price context before confirmation.",
    reason: "Reduces basket cost without silently trading away protein, pack realism, or freshness.",
    requiresConfirmation: true,
  },
];

export function previewForAction(actionId: string) {
  return AGENT_PREVIEWS.find((preview) => preview.actionId === actionId);
}
