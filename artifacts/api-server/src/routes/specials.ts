import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, specialsTable, productsTable, retailersTable, userProfileTable } from "@workspace/db";
import { ListSpecialsQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

type SpecialRow = {
  special: typeof specialsTable.$inferSelect;
  product: typeof productsTable.$inferSelect | null;
  retailer: typeof retailersTable.$inferSelect | null;
};

type SpecialStatus = "current" | "expired" | "upcoming" | "all";
type SpecialFilters = {
  retailerId?: number;
  category?: string;
  goalFit?: string;
  status?: SpecialStatus;
  region?: string;
  store?: string;
  channel?: string;
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function specialStatus(special: typeof specialsTable.$inferSelect, today: string): Exclude<SpecialStatus, "all"> | "undated" {
  if (!special.validFrom || !special.validUntil) return "undated";
  if (special.validFrom > today) return "upcoming";
  if (special.validUntil < today) return "expired";
  return "current";
}

function matchesTextFilter(value: string | null, filter?: string) {
  return !filter || value?.toLowerCase() === filter.toLowerCase();
}

function parseBooleanQuery(value: unknown) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  if (rawValue === true || rawValue === "true" || rawValue === "1") return true;
  if (rawValue === false || rawValue === "false" || rawValue === "0") return false;
  return undefined;
}

function buildSpecialResponse({ special, product, retailer }: SpecialRow) {
  return {
    id: special.id,
    productId: special.productId,
    productName: product?.name ?? "Unknown",
    retailerId: special.retailerId,
    retailerName: retailer?.name ?? "Unknown",
    regularPriceAud: special.regularPriceAud,
    specialPriceAud: special.specialPriceAud,
    savingsAud: special.savingsAud,
    savingsPercent: special.savingsPercent,
    category: product?.category ?? "other",
    imageUrl: product?.imageUrl ?? "",
    goalFit: special.goalFit,
    promotionType: special.promotionType,
    multibuyQuantity: special.multibuyQuantity ?? null,
    multibuyPrice: special.multibuyPrice ?? null,
    loyaltyRequired: special.loyaltyRequired,
    stockStatus: special.stockStatus,
    region: special.region ?? null,
    store: special.store ?? null,
    channel: special.channel,
    currency: special.currency,
    terms: special.terms ?? null,
    sourceUrl: special.sourceUrl ?? null,
    validFrom: special.validFrom ?? null,
    validUntil: special.validUntil ?? null,
    lastVerifiedAt: special.lastVerifiedAt?.toISOString() ?? null,
  };
}

async function listSpecialRows(params: ReturnType<typeof ListSpecialsQueryParams.safeParse>, rawQuery: Record<string, unknown>, defaultStatus: SpecialStatus) {
  const today = todayIsoDate();
  const rows = await db
    .select({
      special: specialsTable,
      product: productsTable,
      retailer: retailersTable,
    })
    .from(specialsTable)
    .leftJoin(productsTable, eq(productsTable.id, specialsTable.productId))
    .leftJoin(retailersTable, eq(retailersTable.id, specialsTable.retailerId))
    .orderBy(desc(specialsTable.savingsPercent));

  const filters: SpecialFilters = params.success ? params.data : {};
  const status = (filters.status ?? defaultStatus) as SpecialStatus;
  const loyaltyOnly = parseBooleanQuery(rawQuery.loyaltyOnly);

  return rows.filter(({ special, product }) => {
    if (status !== "all" && specialStatus(special, today) !== status) return false;
    if (special.isStale && status === "current") return false;
    if (filters.retailerId && special.retailerId !== filters.retailerId) return false;
    if (filters.category && product?.category !== filters.category) return false;
    if (filters.goalFit && !special.goalFit.includes(filters.goalFit)) return false;
    if (!matchesTextFilter(special.region, filters.region)) return false;
    if (!matchesTextFilter(special.store, filters.store)) return false;
    if (filters.channel && special.channel !== filters.channel) return false;
    if (loyaltyOnly === true && !special.loyaltyRequired) return false;
    return true;
  });
}

router.get("/specials", async (req, res): Promise<void> => {
  const params = ListSpecialsQueryParams.safeParse(req.query);
  const allSpecials = await listSpecialRows(params, req.query, "current");
  res.json(allSpecials.map(buildSpecialResponse));
});

router.get("/specials/best-value", async (req, res): Promise<void> => {
  const profiles = await db.select().from(userProfileTable).limit(1);
  const diet = profiles[0]?.dietPreference ?? "standard";

  const goalMap: Record<string, string> = {
    high_protein: "high_protein",
    low_calorie: "low_calorie",
    vegan: "vegan",
    low_carb: "low_carb",
  };
  const goalTag = goalMap[diet] ?? null;
  const allSpecials = await listSpecialRows(ListSpecialsQueryParams.safeParse(req.query), req.query, "current");

  const filteredSpecials = goalTag
    ? allSpecials.filter(({ special }) => special.goalFit.includes(goalTag))
    : allSpecials;

  const result = filteredSpecials.slice(0, 10).map(buildSpecialResponse);
  res.json(result);
});

export default router;
