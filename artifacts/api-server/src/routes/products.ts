import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, productsTable, retailersTable } from "@workspace/db";
import { ListProductsQueryParams, GetProductParams, CompareProductParams } from "@workspace/api-zod";

const router: IRouter = Router();

function parseId(raw: unknown): number {
  return parseInt(Array.isArray(raw) ? raw[0] : String(raw), 10);
}

async function buildProductResponse(product: typeof productsTable.$inferSelect) {
  const retailers = await db
    .select()
    .from(retailersTable)
    .where(eq(retailersTable.id, product.retailerId))
    .limit(1);
  const retailerName = retailers[0]?.name ?? "Unknown";

  const savingsAud =
    product.isOnSpecial && product.regularPriceAud
      ? Math.round((product.regularPriceAud - product.priceAud) * 100) / 100
      : null;
  const savingsPercent =
    product.isOnSpecial && product.regularPriceAud
      ? Math.round(((product.regularPriceAud - product.priceAud) / product.regularPriceAud) * 1000) / 10
      : null;

  return {
    ...product,
    retailerName,
    savingsAud,
    savingsPercent,
    brand: product.brand ?? null,
    regularPriceAud: product.regularPriceAud ?? null,
    fiberPer100g: product.fiberPer100g ?? null,
    sugarPer100g: product.sugarPer100g ?? null,
  };
}

router.get("/retailers", async (_req, res): Promise<void> => {
  const retailers = await db.select().from(retailersTable).where(eq(retailersTable.isActive, true));
  res.json(retailers);
});

router.get("/products", async (req, res): Promise<void> => {
  const params = ListProductsQueryParams.safeParse(req.query);
  let products = await db.select().from(productsTable);

  if (params.success) {
    const { query, retailerId, category, onSpecial, maxPrice } = params.data;
    products = products.filter((p) => {
      if (query && !p.name.toLowerCase().includes(query.toLowerCase())) return false;
      if (retailerId && p.retailerId !== retailerId) return false;
      if (category && p.category !== category) return false;
      if (onSpecial && !p.isOnSpecial) return false;
      if (maxPrice && p.priceAud > maxPrice) return false;
      return true;
    });
  }

  const result = await Promise.all(products.map(buildProductResponse));
  res.json(result);
});

router.get("/products/:id", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const products = await db.select().from(productsTable).where(eq(productsTable.id, id)).limit(1);
  if (products.length === 0) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  const result = await buildProductResponse(products[0]);
  res.json(result);
});

router.get("/products/:id/compare", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const source = await db.select().from(productsTable).where(eq(productsTable.id, id)).limit(1);
  if (source.length === 0) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  // Find similar products by name similarity across retailers
  const similar = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.category, source[0].category));

  const results = await Promise.all(
    similar.map(async (p) => {
      const built = await buildProductResponse(p);
      const pricePerUnit = p.packSize > 0 ? Math.round((p.priceAud / p.packSize) * 100) / 100 : p.priceAud;
      return { product: built, pricePerUnit, isCheapest: false, isBestValue: false };
    })
  );

  if (results.length > 0) {
    const minPrice = Math.min(...results.map((r) => r.pricePerUnit));
    const minPriceItem = results.find((r) => r.pricePerUnit === minPrice);
    if (minPriceItem) minPriceItem.isCheapest = true;

    // Best value = highest protein per dollar
    const bestRatio = Math.max(
      ...results.map((r) =>
        r.pricePerUnit > 0 ? r.product.proteinPer100g / r.pricePerUnit : 0
      )
    );
    const bestItem = results.find(
      (r) => r.pricePerUnit > 0 && r.product.proteinPer100g / r.pricePerUnit === bestRatio
    );
    if (bestItem) bestItem.isBestValue = true;
  }

  res.json(results.slice(0, 10));
});

export default router;
