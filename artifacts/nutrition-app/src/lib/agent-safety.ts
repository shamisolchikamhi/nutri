export type AgentSafetyBoundary = {
  id: string;
  title: string;
  rule: string;
  userMessage: string;
};

export const AGENT_SAFETY_BOUNDARIES: AgentSafetyBoundary[] = [
  {
    id: "no-diagnosis",
    title: "No diagnosis or treatment",
    rule: "The agent can explain food, logging, and shopping trade-offs, but it must not diagnose symptoms or prescribe treatment.",
    userMessage: "For symptoms, medications, eating-disorder concerns, pregnancy, diabetes, kidney disease, or other medical issues, speak with a qualified clinician.",
  },
  {
    id: "high-risk-goals",
    title: "High-risk goals are escalated",
    rule: "Requests involving extreme weight loss, very low calories, purging, compensatory exercise, or unsafe supplement use are not turned into plans.",
    userMessage: "The agent should pause planning and direct the user toward qualified medical or mental-health support.",
  },
  {
    id: "deficit-limits",
    title: "Aggressive deficits are blocked",
    rule: "The agent avoids aggressive calorie deficits and flags plans that fall below conservative target ranges.",
    userMessage: "Nutrition targets are estimates, not medical prescriptions, and should be adjusted with professional support when risk is present.",
  },
  {
    id: "estimate-labels",
    title: "Estimates are clearly labelled",
    rule: "Unmatched ingredients, stale prices, inferred servings, and generic nutrition values must be labelled before confirmation.",
    userMessage: "Every recommendation should show what is known, estimated, missing, or stale.",
  },
];
