import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, specialsTable, productsTable, retailersTable, userProfileTable } from "@workspace/db";
import { ListSpecialsQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

async function buildSpecialResponse(special: typeof specialsTable.$inferSelect) {
  const products = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, special.productId))
    .limit(1);
  const retailers = await db
    .select()
    .from(retailersTable)
    .where(eq(retailersTable.id, special.retailerId))
    .limit(1);

  const product = products[0];
  const retailer = retailers[0];

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
    validUntil: special.validUntil ?? null,
  };
}

router.get("/specials", async (req, res): Promise<void> => {
  const params = ListSpecialsQueryParams.safeParse(req.query);
  let allSpecials = await db.select().from(specialsTable);

  if (params.success) {
    const { retailerId, goalFit } = params.data;
    if (retailerId) allSpecials = allSpecials.filter((s) => s.retailerId === retailerId);
    if (goalFit) allSpecials = allSpecials.filter((s) => s.goalFit.includes(goalFit));
  }

  const result = await Promise.all(allSpecials.map(buildSpecialResponse));
  res.json(result);
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

  let allSpecials = await db.select().from(specialsTable);
  if (goalTag) {
    allSpecials = allSpecials.filter((s) => s.goalFit.includes(goalTag));
  }

  // Sort by savings percent descending
  allSpecials.sort((a, b) => b.savingsPercent - a.savingsPercent);

  const result = await Promise.all(allSpecials.slice(0, 10).map(buildSpecialResponse));
  res.json(result);
});

export default router;
