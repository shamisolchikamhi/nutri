import { formatMoney } from "@/lib/market";

export type ValueScoreInput = {
  price: number;
  regularPrice?: number | null;
  packSize?: number | null;
  packUnit?: string | null;
  proteinG?: number | null;
  fiberG?: number | null;
  calories?: number | null;
  category?: string | null;
  tags?: string[];
  savingsPercent?: number | null;
};

export type ValueScore = {
  score: number;
  pricePer100: number | null;
  breakdown: Array<{ label: string; detail: string; points: number }>;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function packSizeScore(packSize?: number | null) {
  if (!packSize || packSize <= 0) return 50;
  if (packSize <= 750) return 95;
  if (packSize <= 1500) return 78;
  if (packSize <= 3000) return 58;
  return 35;
}

function goalFitScore(input: ValueScoreInput) {
  const tags = new Set((input.tags ?? []).map((tag) => tag.toLowerCase()));
  if (tags.has("high_protein") || (input.proteinG ?? 0) >= 15) return 92;
  if (tags.has("budget") || input.category === "pantry") return 82;
  if (tags.has("fat_loss") || (input.calories ?? 999) <= 150) return 76;
  if (input.category === "snacks") return 48;
  return 62;
}

export function calculateValueScore(input: ValueScoreInput): ValueScore {
  const unit = input.packUnit?.toLowerCase() ?? "";
  const canNormalize = Boolean(input.packSize && input.packSize > 0 && ["g", "ml"].includes(unit));
  const pricePer100 = canNormalize ? (input.price / Number(input.packSize)) * 100 : null;
  const pricePoints = pricePer100 == null ? 55 : clamp(100 - pricePer100 * 5);
  const proteinPoints = clamp((input.proteinG ?? 0) * 3.5);
  const fiberPoints = input.fiberG == null ? 45 : clamp(input.fiberG * 12);
  const goalPoints = goalFitScore(input);
  const wastePoints = packSizeScore(input.packSize);
  const savingsPoints = clamp(input.savingsPercent ?? (input.regularPrice ? ((input.regularPrice - input.price) / input.regularPrice) * 100 : 0));

  const score = Math.round(
    pricePoints * 0.32 +
    proteinPoints * 0.22 +
    fiberPoints * 0.16 +
    goalPoints * 0.16 +
    wastePoints * 0.10 +
    savingsPoints * 0.04
  );

  return {
    score,
    pricePer100,
    breakdown: [
      {
        label: "Price",
        detail: pricePer100 == null ? "Pack size not normalised" : `${formatMoney(pricePer100)} per 100${unit}`,
        points: Math.round(pricePoints),
      },
      {
        label: "Protein/fibre",
        detail: `${input.proteinG ?? 0}g protein${input.fiberG != null ? `, ${input.fiberG}g fibre` : ""} per 100g`,
        points: Math.round((proteinPoints + fiberPoints) / 2),
      },
      {
        label: "Goal fit",
        detail: (input.tags ?? []).length ? (input.tags ?? []).map((tag) => tag.replace("_", " ")).join(", ") : input.category ?? "general",
        points: Math.round(goalPoints),
      },
      {
        label: "Waste risk",
        detail: input.packSize ? `${input.packSize}${input.packUnit ?? ""} pack size` : "Unknown pack size",
        points: Math.round(wastePoints),
      },
      {
        label: "Special",
        detail: savingsPoints > 0 ? `${Math.round(savingsPoints)}% observed saving` : "No special saving",
        points: Math.round(savingsPoints),
      },
    ],
  };
}
