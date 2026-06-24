import { Router, type IRouter } from "express";
import { db, productsTable, retailersTable, specialsTable } from "@workspace/db";

const router: IRouter = Router();

function hoursSince(value: Date | null) {
  if (!value) return null;
  return Math.max(0, Math.floor((Date.now() - value.getTime()) / (1000 * 60 * 60)));
}

function statusFor(hours: number | null) {
  if (hours == null) return "unverified";
  if (hours > 48) return "stale";
  if (hours > 24) return "watch";
  return "healthy";
}

router.get("/retailer-status", async (_req, res): Promise<void> => {
  const [retailers, products, specials] = await Promise.all([
    db.select().from(retailersTable),
    db.select().from(productsTable),
    db.select().from(specialsTable),
  ]);
  const today = new Date().toISOString().slice(0, 10);

  res.json({
    generatedAt: new Date().toISOString(),
    retailers: retailers.map((retailer) => {
      const retailerProducts = products.filter((product) => product.retailerId === retailer.id);
      const retailerSpecials = specials.filter((special) => special.retailerId === retailer.id);
      const activePromotionCount = retailerSpecials.filter((special) =>
        !special.isStale &&
        !!special.validFrom &&
        !!special.validUntil &&
        special.validFrom <= today &&
        special.validUntil >= today
      ).length;
      const stalePromotionCount = retailerSpecials.filter((special) => special.isStale || (!!special.validUntil && special.validUntil < today)).length;
      const verifiedHoursAgo = hoursSince(retailer.lastVerifiedAt);

      return {
        retailerId: retailer.id,
        retailerName: retailer.name,
        marketCode: retailer.marketCode,
        channel: retailer.channel,
        isActive: retailer.isActive,
        productCount: retailerProducts.length,
        activePromotionCount,
        stalePromotionCount,
        scrapedAt: retailer.scrapedAt?.toISOString() ?? null,
        lastVerifiedAt: retailer.lastVerifiedAt?.toISOString() ?? null,
        verifiedHoursAgo,
        status: statusFor(verifiedHoursAgo),
      };
    }),
  });
});

export default router;
