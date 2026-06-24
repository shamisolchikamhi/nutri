import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, productsTable, retailersTable, specialsTable } from "@workspace/db";

const router: IRouter = Router();

function currentSeason(month = new Date().getMonth()) {
  if ([11, 0, 1].includes(month)) return "summer";
  if ([2, 3, 4].includes(month)) return "autumn";
  if ([5, 6, 7].includes(month)) return "winter";
  return "spring";
}

function stapleCategoriesForMarket(marketCode: string) {
  if (marketCode === "ZA") return ["protein", "pantry", "fruit_veg", "dairy"];
  return ["protein", "grains", "fruit_veg", "dairy"];
}

function seasonalNotes(marketCode: string) {
  const season = currentSeason();
  if (marketCode === "ZA") {
    const notes: Record<string, string[]> = {
      summer: ["Stone fruit, tomatoes, salad greens, and braai proteins tend to be stronger seasonal fits.", "Watch bulk cold-chain packs carefully to avoid waste during hot weeks."],
      autumn: ["Apples, pears, root vegetables, oats, and batch-cook proteins are reliable local staples.", "Freezer-friendly packs can stretch specials into the following week."],
      winter: ["Soups, stews, legumes, citrus, oats, and frozen vegetables usually support budget and nutrition goals.", "Bigger pantry packs are lower waste when they are shelf-stable."],
      spring: ["Leafy greens, berries, yoghurt, chicken, and lighter meal-prep staples are useful seasonal anchors.", "Prefer smaller fresh packs unless the meal plan uses them twice."],
    };
    return notes[season];
  }
  return ["Prioritize local fresh produce in season and shelf-stable staples for budget control.", "Check pack size against the meal plan before buying fresh bulk offers."];
}

router.get("/market-intelligence", async (req, res): Promise<void> => {
  const marketCode = typeof req.query.marketCode === "string" ? req.query.marketCode.toUpperCase() : "ZA";
  const [retailers, products, specials] = await Promise.all([
    db.select().from(retailersTable).where(eq(retailersTable.isActive, true)),
    db.select().from(productsTable),
    db.select().from(specialsTable),
  ]);
  const marketRetailers = retailers.filter((retailer) => retailer.marketCode === marketCode);
  const retailerIds = new Set(marketRetailers.map((retailer) => retailer.id));
  const marketProducts = products.filter((product) => retailerIds.has(product.retailerId));
  const marketSpecials = specials.filter((special) => retailerIds.has(special.retailerId) && !special.isStale);

  const retailerHighlights = marketRetailers.map((retailer) => {
    const retailerProducts = marketProducts.filter((product) => product.retailerId === retailer.id);
    const retailerSpecials = marketSpecials.filter((special) => special.retailerId === retailer.id);
    const topCategory = Object.entries(retailerProducts.reduce<Record<string, number>>((counts, product) => {
      counts[product.category] = (counts[product.category] ?? 0) + 1;
      return counts;
    }, {})).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "mixed basket";
    return {
      retailerId: retailer.id,
      retailerName: retailer.name,
      productCount: retailerProducts.length,
      activeSpecialCount: retailerSpecials.length,
      strength: retailerSpecials.length > 0
        ? `${retailer.name} currently has ${retailerSpecials.length} observed offer(s), strongest around ${topCategory.replace("_", " ")}.`
        : `${retailer.name} has catalogue coverage for ${topCategory.replace("_", " ")} but no current observed offer.`,
    };
  });

  const packSizeNotes = marketProducts
    .filter((product) => product.packSize && product.packUnit)
    .slice(0, 4)
    .map((product) => `${product.name}: ${product.packSize}${product.packUnit} at ${product.retailerId ? marketRetailers.find((retailer) => retailer.id === product.retailerId)?.name ?? "retailer" : "retailer"}`);

  res.json({
    marketCode,
    season: currentSeason(),
    stapleCategories: stapleCategoriesForMarket(marketCode),
    retailerHighlights,
    packSizeNotes,
    seasonalNotes: seasonalNotes(marketCode),
    updatedAt: new Date().toISOString(),
  });
});

export default router;
