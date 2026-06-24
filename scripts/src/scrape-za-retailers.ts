import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { retailerAdapters, type RetailerKey } from "./retailers";
import { fetchRenderedHtml } from "./retailers/browser-fetch";
import { lawfulFallbackForBlockedSource, retailerSourcePolicies } from "./retailers/source-policies";

type RetailerConfig = {
  key: RetailerKey;
  name: string;
  logoUrl: string;
  urls: string[];
};

export type RetailerScrapeMetrics = {
  requests: number;
  successfulRequests: number;
  failedRequests: number;
  blockedRequests: number;
  extractionCount: number;
  parseFailures: number;
  changedPrices: number;
  newPromotions: number;
  expiredPromotions: number;
  lastSuccessfulRun: string | null;
};

export type ScrapedProduct = {
  externalId: string;
  sourceUrl: string;
  name: string;
  brand: string | null;
  category: string;
  currency: string;
  priceAud: number;
  regularPriceAud: number | null;
  promotionType: "single_price" | "percentage" | "multibuy" | "loyalty" | null;
  validFrom: string | null;
  validUntil: string | null;
  packSize: number;
  packUnit: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g: number | null;
  sugarPer100g: number | null;
  imageUrl: string;
};

type RejectedScrapedProduct = {
  retailer: string;
  externalId: string;
  name: string;
  sourceUrl: string;
  reasons: string[];
};

type ReviewQueueItem = RejectedScrapedProduct & {
  queue: "retailer_product_match_review";
};

type NutritionEstimate = Pick<
  ScrapedProduct,
  "caloriesPer100g" | "proteinPer100g" | "carbsPer100g" | "fatPer100g" | "fiberPer100g" | "sugarPer100g"
>;

const SEARCH_TERMS = ["oats", "chicken", "rice", "milk", "yoghurt", "tuna", "beans", "peanut butter"];

const RETAILERS: Record<RetailerKey, RetailerConfig> = {
  woolworths: {
    key: "woolworths",
    name: "Woolworths Food",
    logoUrl: "https://www.woolworths.co.za/favicon.ico",
    urls: [
      "https://www.woolworths.co.za/cat/Porridge-Oats/Porridge-Oats/_/N-18imfo9",
      "https://www.woolworths.co.za/cat/Food/Food-Basket/Banners/Everyday-WList/Pantry/Cereal-Oats-Maize-Jam-Peanut-Butter/Cereal-Oats-Maize-Jam-Peanut-Butter/_/N-1w64rhk",
      ...SEARCH_TERMS.map((term) => `https://www.woolworths.co.za/cat?Ntt=${encodeURIComponent(term)}`),
    ],
  },
  "pick-n-pay": {
    key: "pick-n-pay",
    name: "Pick n Pay",
    logoUrl: "https://www.pnp.co.za/favicon.ico",
    urls: SEARCH_TERMS.flatMap((term) => [
      `https://www.pnp.co.za/pnpstorefront/pnp/en/search/?text=${encodeURIComponent(term)}`,
      `https://www.pnp.co.za/search?text=${encodeURIComponent(term)}`,
    ]),
  },
  checkers: {
    key: "checkers",
    name: "Checkers",
    logoUrl: "https://www.checkers.co.za/favicon.ico",
    urls: SEARCH_TERMS.flatMap((term) => [
      `https://www.checkers.co.za/search/all?q=${encodeURIComponent(term)}`,
      `https://www.checkers.co.za/search?text=${encodeURIComponent(term)}`,
    ]),
  },
};

function getArg(name: string, fallback?: string) {
  const prefix = `--${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

function createMetrics(): RetailerScrapeMetrics {
  return {
    requests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    blockedRequests: 0,
    extractionCount: 0,
    parseFailures: 0,
    changedPrices: 0,
    newPromotions: 0,
    expiredPromotions: 0,
    lastSuccessfulRun: null,
  };
}

function sleep(ms: number) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

export function buildScraperAlerts(metrics: RetailerScrapeMetrics, expectedMinimumExtractions: number) {
  const alerts: string[] = [];
  if (metrics.blockedRequests > 0) alerts.push(`blocked requests detected: ${metrics.blockedRequests}`);
  if (metrics.extractionCount < expectedMinimumExtractions) alerts.push(`extraction count below threshold: ${metrics.extractionCount}/${expectedMinimumExtractions}`);
  if (!metrics.lastSuccessfulRun) alerts.push("no successful scrape run");
  return alerts;
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function htmlToLines(html: string) {
  return decodeHtml(html)
    .replace(/<script[\s\S]*?<\/script>/gi, "\n")
    .replace(/<style[\s\S]*?<\/style>/gi, "\n")
    .replace(/<[^>]+>/g, "\n")
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function parsePrice(line: string) {
  const deal = line.match(/^(?:in-store deal\s*:?\s*)?r\s*([\d\s]+(?:[.,]\d{2})?)$/i);
  if (!deal) return null;
  const value = Number.parseFloat(deal[1].replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null;
}

function parsePriceAt(lines: string[], index: number) {
  const direct = parsePrice(lines[index]);
  if (direct) return direct;
  if (/^r$/i.test(lines[index] ?? "") && /^[\d\s]+(?:[.,]\d{2})?$/.test(lines[index + 1] ?? "")) {
    return parsePrice(`R${lines[index + 1]}`);
  }
  return null;
}

function parsePack(name: string) {
  const match = name.toLowerCase().match(/(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml)|(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml|sachets?|packs?|each|unit)/);
  if (!match) return { packSize: 1, packUnit: "unit" };

  if (match[1] && match[2] && match[3]) {
    const count = Number.parseFloat(match[1].replace(",", "."));
    const size = Number.parseFloat(match[2].replace(",", "."));
    const unit = match[3];
    return normalizePack(count * size, unit);
  }

  const amount = Number.parseFloat((match[4] ?? "1").replace(",", "."));
  const unit = match[5] ?? "unit";
  return normalizePack(amount, unit);
}

function normalizePack(amount: number, unit: string) {
  if (!Number.isFinite(amount) || amount <= 0) return { packSize: 1, packUnit: "unit" };
  if (unit === "g") return { packSize: Math.round((amount / 1000) * 1000) / 1000, packUnit: "kg" };
  if (unit === "ml") return { packSize: Math.round((amount / 1000) * 1000) / 1000, packUnit: "l" };
  if (unit.startsWith("sachet") || unit.startsWith("pack") || unit === "each") return { packSize: amount, packUnit: "unit" };
  return { packSize: amount, packUnit: unit };
}

function mapCategory(name: string, sourceUrl: string) {
  const text = `${name} ${sourceUrl}`.toLowerCase();
  if (/(chicken|beef|fish|tuna|egg|lentil|bean|protein)/.test(text)) return "protein";
  if (/(milk|yoghurt|yogurt|cheese|dairy)/.test(text)) return "dairy";
  if (/(rice|oat|pasta|bread|cereal|grain|porridge|maize)/.test(text)) return "grains";
  if (/(fruit|vegetable|broccoli|spinach|banana|apple)/.test(text)) return "fruit_veg";
  if (/(snack|chips|biscuit|bar|chocolate)/.test(text)) return "snacks";
  if (/(drink|juice|beverage|water)/.test(text)) return "drinks";
  if (/(sauce|spice|condiment|peanut butter|jam)/.test(text)) return "condiments";
  if (/(frozen)/.test(text)) return "frozen";
  return "pantry";
}

function nutritionEstimate(name: string, category: string) {
  const text = name.toLowerCase();
  if (/chicken/.test(text)) return { caloriesPer100g: 165, proteinPer100g: 31, carbsPer100g: 0, fatPer100g: 3.6, fiberPer100g: null, sugarPer100g: null };
  if (/tuna/.test(text)) return { caloriesPer100g: 132, proteinPer100g: 28, carbsPer100g: 0, fatPer100g: 1, fiberPer100g: null, sugarPer100g: null };
  if (/egg/.test(text)) return { caloriesPer100g: 155, proteinPer100g: 13, carbsPer100g: 1.1, fatPer100g: 11, fiberPer100g: null, sugarPer100g: null };
  if (/oat|porridge/.test(text)) return { caloriesPer100g: 389, proteinPer100g: 16.9, carbsPer100g: 66, fatPer100g: 6.9, fiberPer100g: 10.6, sugarPer100g: 1 };
  if (/rice/.test(text)) return { caloriesPer100g: 365, proteinPer100g: 7.1, carbsPer100g: 80, fatPer100g: 0.7, fiberPer100g: 1.3, sugarPer100g: 0.1 };
  if (/milk/.test(text)) return { caloriesPer100g: 50, proteinPer100g: 3.4, carbsPer100g: 5, fatPer100g: 1.8, fiberPer100g: null, sugarPer100g: 5 };
  if (/yoghurt|yogurt/.test(text)) return { caloriesPer100g: 95, proteinPer100g: 5.5, carbsPer100g: 7, fatPer100g: 4, fiberPer100g: null, sugarPer100g: 6 };
  if (/peanut butter/.test(text)) return { caloriesPer100g: 588, proteinPer100g: 25, carbsPer100g: 20, fatPer100g: 50, fiberPer100g: 6, sugarPer100g: 9 };

  const byCategory: Record<string, NutritionEstimate> = {
    protein: { caloriesPer100g: 180, proteinPer100g: 20, carbsPer100g: 4, fatPer100g: 7, fiberPer100g: null, sugarPer100g: null },
    dairy: { caloriesPer100g: 90, proteinPer100g: 5, carbsPer100g: 7, fatPer100g: 4, fiberPer100g: null, sugarPer100g: 5 },
    grains: { caloriesPer100g: 350, proteinPer100g: 9, carbsPer100g: 70, fatPer100g: 3, fiberPer100g: 5, sugarPer100g: 2 },
    fruit_veg: { caloriesPer100g: 55, proteinPer100g: 1.5, carbsPer100g: 12, fatPer100g: 0.4, fiberPer100g: 3, sugarPer100g: 7 },
    snacks: { caloriesPer100g: 480, proteinPer100g: 7, carbsPer100g: 58, fatPer100g: 24, fiberPer100g: 3, sugarPer100g: 12 },
    drinks: { caloriesPer100g: 42, proteinPer100g: 0, carbsPer100g: 10, fatPer100g: 0, fiberPer100g: null, sugarPer100g: 10 },
    condiments: { caloriesPer100g: 320, proteinPer100g: 8, carbsPer100g: 25, fatPer100g: 18, fiberPer100g: 4, sugarPer100g: 12 },
    frozen: { caloriesPer100g: 180, proteinPer100g: 8, carbsPer100g: 20, fatPer100g: 7, fiberPer100g: 2, sugarPer100g: 3 },
    pantry: { caloriesPer100g: 280, proteinPer100g: 7, carbsPer100g: 48, fatPer100g: 6, fiberPer100g: 4, sugarPer100g: 5 },
  };

  return byCategory[category] ?? byCategory.pantry;
}

function looksLikeProductName(line: string) {
  if (line.length < 4 || line.length > 120) return false;
  if (/^(sort by|relevance|add|shop|buy|save|valid|items found|food cupboard|online|delivery|search|home|account|in-store deal|:)$/i.test(line)) return false;
  if (/^\(?\d+\)?$/.test(line)) return false;
  if (/^r\s*\d/i.test(line)) return false;
  if (/^r$/i.test(line)) return false;
  return /[a-z]/i.test(line);
}

function extractProductsFromHtml(html: string, retailer: RetailerConfig, sourceUrl: string, limit: number) {
  const structured = retailerAdapters[retailer.key].parse(html, sourceUrl).slice(0, limit);
  if (structured.length > 0) {
    return structured.map((listing): ScrapedProduct => {
      const category = mapCategory(listing.name, listing.sourceUrl);
      return {
        externalId: listing.externalId,
        sourceUrl: listing.sourceUrl,
        name: listing.name,
        brand: listing.brand,
        category,
        currency: listing.currency,
        priceAud: listing.price,
        regularPriceAud: listing.regularPrice,
        promotionType: listing.promotionType,
        validFrom: listing.validFrom,
        validUntil: listing.validUntil,
        packSize: listing.packSize,
        packUnit: listing.packUnit,
        ...nutritionEstimate(listing.name, category),
        imageUrl: listing.imageUrl,
      };
    });
  }

  const lines = htmlToLines(html);
  const products: ScrapedProduct[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < lines.length; index += 1) {
    const price = parsePriceAt(lines, index);
    if (!price) continue;

    const name = Array.from({ length: 8 }, (_, offset) => lines[index - offset - 1])
      .find((candidate) => candidate && looksLikeProductName(candidate));
    if (!name) continue;

    const key = `${retailer.key}:${name.toLowerCase()}:${price}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const category = mapCategory(name, sourceUrl);
    const pack = parsePack(name);
    products.push({
      externalId: key,
      sourceUrl,
      name,
      brand: name.split(" ")[0] || null,
      category,
      currency: "ZAR",
      priceAud: price,
      regularPriceAud: null,
      promotionType: null,
      validFrom: null,
      validUntil: null,
      packSize: pack.packSize,
      packUnit: pack.packUnit,
      ...nutritionEstimate(name, category),
      imageUrl: "",
    });

    if (products.length >= limit) break;
  }

  return products;
}

async function fetchHtml(url: string, render = false) {
  if (render) return fetchRenderedHtml(url);
  const response = await fetch(url, {
    headers: {
      "Accept": "text/html,application/xhtml+xml",
      "User-Agent": "NutriBasket/0.1 retail data importer (+development)",
    },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.text();
}

async function scrapeRetailer(retailer: RetailerConfig, limit: number, render = false, delayMs = 1500) {
  const productsByKey = new Map<string, ScrapedProduct>();
  const metrics = createMetrics();
  for (const url of retailer.urls) {
    try {
      metrics.requests += 1;
      const html = await fetchHtml(url, render);
      const products = extractProductsFromHtml(html, retailer, url, Math.max(10, limit - productsByKey.size));
      metrics.successfulRequests += 1;
      metrics.extractionCount += products.length;
      if (products.length === 0) metrics.parseFailures += 1;
      metrics.lastSuccessfulRun = new Date().toISOString();
      for (const product of products) {
        productsByKey.set(`${retailer.key}:${product.name.toLowerCase()}`, product);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      metrics.failedRequests += 1;
      if (/\b(401|403|429)\b|blocked|captcha/i.test(message)) metrics.blockedRequests += 1;
      console.warn(`${retailer.name}: failed ${url}: ${message}`);
    }
    if (productsByKey.size >= limit) break;
    if (delayMs > 0) await sleep(delayMs);
  }
  return { products: [...productsByKey.values()].slice(0, limit), metrics };
}

function isIsoDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp);
}

function hasAmbiguousPack(product: ScrapedProduct) {
  return product.packUnit === "unit" && product.packSize === 1 && !/\b(each|single|unit)\b/i.test(product.name);
}

function productReviewReasons(product: ScrapedProduct) {
  const reasons: string[] = [];

  if (!product.externalId.trim()) reasons.push("missing external id");
  if (!product.sourceUrl.startsWith("https://")) reasons.push("missing secure source url");
  if (!Number.isFinite(product.priceAud) || product.priceAud <= 0) reasons.push("invalid price");
  if (product.regularPriceAud != null && (!Number.isFinite(product.regularPriceAud) || product.regularPriceAud <= product.priceAud)) reasons.push("impossible savings");
  if (product.currency !== "ZAR") reasons.push(`mismatched currency ${product.currency}`);
  if (product.regularPriceAud != null && (!isIsoDate(product.validFrom) || !isIsoDate(product.validUntil))) reasons.push("missing promotion dates");
  if (product.validFrom && product.validUntil && product.validFrom > product.validUntil) reasons.push("promotion dates out of order");
  if (!Number.isFinite(product.packSize) || product.packSize <= 0 || hasAmbiguousPack(product)) reasons.push("ambiguous pack size");

  return reasons;
}

export function applyDataQualityGates(products: ScrapedProduct[], retailerName: string) {
  const accepted: ScrapedProduct[] = [];
  const rejected: RejectedScrapedProduct[] = [];
  const reviewQueue: ReviewQueueItem[] = [];
  const seen = new Set<string>();

  for (const product of products) {
    const reasons = productReviewReasons(product);
    const duplicateKey = `${product.externalId.toLowerCase()}|${product.name.toLowerCase()}|${product.packSize}|${product.packUnit}`;
    if (seen.has(duplicateKey)) reasons.push("duplicate product");
    seen.add(duplicateKey);

    if (reasons.length > 0) {
      const rejectedProduct = {
        retailer: retailerName,
        externalId: product.externalId,
        name: product.name,
        sourceUrl: product.sourceUrl,
        reasons,
      };
      rejected.push(rejectedProduct);
      reviewQueue.push({ ...rejectedProduct, queue: "retailer_product_match_review" });
      continue;
    }

    accepted.push(product);
  }

  return { accepted, rejected, reviewQueue };
}

async function getOrCreateRetailer(retailer: RetailerConfig) {
  const [{ and, eq }, { db, retailersTable }] = await Promise.all([
    import("drizzle-orm"),
    import("@workspace/db"),
  ]);

  const existing = await db
    .select()
    .from(retailersTable)
    .where(and(eq(retailersTable.name, retailer.name), eq(retailersTable.marketCode, "ZA")))
    .limit(1);

  if (existing[0]) return existing[0];

  const [created] = await db
    .insert(retailersTable)
    .values({
      name: retailer.name,
      externalId: retailer.key,
      marketCode: "ZA",
      canonicalSourceUrl: retailer.urls[0],
      channel: "online",
      currency: "ZAR",
      logoUrl: retailer.logoUrl,
      isActive: true,
      scrapedAt: new Date(),
      lastVerifiedAt: new Date(),
    })
    .returning();

  return created;
}

async function writeProducts(products: ScrapedProduct[], retailer: RetailerConfig, metrics = createMetrics()) {
  const [{ and, eq, lt }, { db, productsTable, productPriceHistoryTable, specialsTable }] = await Promise.all([
    import("drizzle-orm"),
    import("@workspace/db"),
  ]);
  const row = await getOrCreateRetailer(retailer);
  let inserted = 0;
  let updated = 0;
  const seenPromotionIds = new Set<string>();

  for (const product of products) {
    const existing = await db
      .select()
      .from(productsTable)
      .where(and(eq(productsTable.name, product.name), eq(productsTable.retailerId, row.id)))
      .limit(1);

    const values = {
      name: product.name,
      externalId: product.externalId,
      canonicalSourceUrl: product.sourceUrl,
      brand: product.brand,
      retailerId: row.id,
      channel: "online",
      currency: "ZAR",
      category: product.category,
      priceAud: product.priceAud,
      regularPriceAud: product.regularPriceAud,
      packSize: product.packSize,
      packUnit: product.packUnit,
      caloriesPer100g: product.caloriesPer100g,
      proteinPer100g: product.proteinPer100g,
      carbsPer100g: product.carbsPer100g,
      fatPer100g: product.fatPer100g,
      fiberPer100g: product.fiberPer100g,
      sugarPer100g: product.sugarPer100g,
      isOnSpecial: false,
      stockStatus: "unknown",
      imageUrl: product.imageUrl,
      lastSeenAt: new Date(),
      scrapedAt: new Date(),
      lastVerifiedAt: new Date(),
    };

    let productRow;
    if (existing[0]) {
      if (existing[0].priceAud !== product.priceAud || existing[0].regularPriceAud !== product.regularPriceAud) metrics.changedPrices += 1;
      [productRow] = await db.update(productsTable).set(values).where(eq(productsTable.id, existing[0].id)).returning();
      updated += 1;
    } else {
      [productRow] = await db.insert(productsTable).values(values).returning();
      inserted += 1;
    }
    await db.insert(productPriceHistoryTable).values({ productId: productRow.id, price: product.priceAud, regularPrice: product.regularPriceAud, currency: product.currency, sourceUrl: product.sourceUrl });

    if (product.regularPriceAud && product.regularPriceAud > product.priceAud) {
      const externalId = `${product.externalId}:offer`;
      seenPromotionIds.add(externalId);
      const existingPromotion = await db
        .select()
        .from(specialsTable)
        .where(and(eq(specialsTable.retailerId, row.id), eq(specialsTable.externalId, externalId)))
        .limit(1);
      if (!existingPromotion[0]) metrics.newPromotions += 1;
      const savings = Math.round((product.regularPriceAud - product.priceAud) * 100) / 100;
      await db.insert(specialsTable).values({
        externalId,
        productId: productRow.id,
        retailerId: row.id,
        promotionType: product.promotionType ?? "single_price",
        regularPriceAud: product.regularPriceAud,
        specialPriceAud: product.priceAud,
        savingsAud: savings,
        savingsPercent: Math.round((savings / product.regularPriceAud) * 1000) / 10,
        sourceUrl: product.sourceUrl,
        currency: product.currency,
        validFrom: product.validFrom,
        validUntil: product.validUntil,
        isStale: false,
        lastSeenAt: new Date(),
        scrapedAt: new Date(),
        lastVerifiedAt: new Date(),
      }).onConflictDoUpdate({
        target: [specialsTable.retailerId, specialsTable.externalId],
        set: { specialPriceAud: product.priceAud, regularPriceAud: product.regularPriceAud, savingsAud: savings, validFrom: product.validFrom, validUntil: product.validUntil, isStale: false, lastSeenAt: new Date(), scrapedAt: new Date(), lastVerifiedAt: new Date() },
      });
    }
  }

  const knownPromotions = await db.select().from(specialsTable).where(eq(specialsTable.retailerId, row.id));
  for (const promotion of knownPromotions) {
    if (promotion.externalId && !seenPromotionIds.has(promotion.externalId)) {
      metrics.expiredPromotions += 1;
      await db.update(specialsTable).set({ isStale: true }).where(eq(specialsTable.id, promotion.id));
    }
  }
  const today = new Date().toISOString().slice(0, 10);
  await db.update(specialsTable).set({ isStale: true }).where(and(eq(specialsTable.retailerId, row.id), lt(specialsTable.validUntil, today)));

  return { retailer: retailer.name, retailerId: row.id, inserted, updated, metrics };
}

async function closePool() {
  const { pool } = await import("@workspace/db");
  await pool.end();
}

function parseRetailerKeys(value: string | undefined): RetailerKey[] {
  if (!value || value === "all") return ["woolworths", "pick-n-pay", "checkers"];
  return value.split(",").map((item) => item.trim()).filter(Boolean) as RetailerKey[];
}

async function main() {
  const retailerKeys = parseRetailerKeys(getArg("retailer", "all"));
  const limit = Number.parseInt(getArg("limit", "60") ?? "60", 10);
  const shouldWrite = hasFlag("write");
  const render = hasFlag("render");
  const delayMs = Number.parseInt(getArg("delay-ms", "1500") ?? "1500", 10);
  const fixturePath = getArg("from");
  const outPath = resolve(getArg("out", "scripts/out/za-retailers.json") ?? "");
  const reviewOutPath = resolve(getArg("review-out", "scripts/out/retailer-review-queue.json") ?? "");
  const statusOutPath = resolve(getArg("status-out", "scripts/out/retailer-run-status.json") ?? "");

  let productsByRetailer: Record<string, ScrapedProduct[]> = {};
  const metricsByRetailer: Record<string, RetailerScrapeMetrics> = {};
  if (fixturePath) {
    const fixture = JSON.parse(await readFile(resolve(fixturePath), "utf8")) as { productsByRetailer?: Record<string, ScrapedProduct[]> };
    productsByRetailer = fixture.productsByRetailer ?? {};
    for (const [retailerName, products] of Object.entries(productsByRetailer)) {
      metricsByRetailer[retailerName] = {
        ...createMetrics(),
        extractionCount: products.length,
        lastSuccessfulRun: products.length > 0 ? new Date().toISOString() : null,
      };
    }
  } else {
    for (const key of retailerKeys) {
      const retailer = RETAILERS[key];
      if (!retailer) throw new Error(`Unsupported retailer "${key}". Use all, woolworths, pick-n-pay, or checkers.`);
      const result = await scrapeRetailer(retailer, limit, render, Number.isFinite(delayMs) ? delayMs : 1500);
      productsByRetailer[retailer.name] = result.products;
      metricsByRetailer[retailer.name] = result.metrics;
    }
  }

  const qualityByRetailer: Record<string, ReturnType<typeof applyDataQualityGates>> = {};
  const acceptedProductsByRetailer: Record<string, ScrapedProduct[]> = {};
  const reviewQueue: ReviewQueueItem[] = [];
  for (const [retailerName, products] of Object.entries(productsByRetailer)) {
    const quality = applyDataQualityGates(products, retailerName);
    qualityByRetailer[retailerName] = quality;
    acceptedProductsByRetailer[retailerName] = quality.accepted;
    reviewQueue.push(...quality.reviewQueue);
  }
  productsByRetailer = acceptedProductsByRetailer;

  if (reviewQueue.length > 0) {
    await mkdir(dirname(reviewOutPath), { recursive: true });
    await writeFile(
      reviewOutPath,
      JSON.stringify({
        queue: "retailer_product_match_review",
        marketCode: "ZA",
        createdAt: new Date().toISOString(),
        items: reviewQueue,
      }, null, 2),
    );
  }

  if (!fixturePath) {
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(
      outPath,
      JSON.stringify({
        source: "Retailer public web pages",
        marketCode: "ZA",
        currencyCode: "ZAR",
        note: "Prices and product names are scraped from public retailer pages. Nutrition is estimated from product/category heuristics until package nutrition labels are parsed.",
        scrapedAt: new Date().toISOString(),
      productsByRetailer,
      quality: Object.fromEntries(Object.entries(qualityByRetailer).map(([retailer, quality]) => [retailer, {
          accepted: quality.accepted.length,
          rejected: quality.rejected.length,
          reviewQueued: quality.reviewQueue.length,
          rejectedProducts: quality.rejected,
        }])),
      }, null, 2),
    );
  }

  const writeResults: Array<{ retailer: string; retailerId: number; inserted: number; updated: number; metrics: RetailerScrapeMetrics }> = [];
  if (shouldWrite) {
    for (const key of retailerKeys) {
      const retailer = RETAILERS[key];
      const products = productsByRetailer[retailer.name] ?? [];
      writeResults.push(await writeProducts(products, retailer, metricsByRetailer[retailer.name] ?? createMetrics()));
    }
    await closePool();
  }

  const status = {
    marketCode: "ZA",
    createdAt: new Date().toISOString(),
    schedule: {
      mode: "retailer-specific",
      recommendedCadence: "hourly during retailer trading hours",
      minimumDelayMsBetweenRequests: Number.isFinite(delayMs) ? delayMs : 1500,
    },
    retailers: Object.fromEntries(Object.entries(metricsByRetailer).map(([retailer, metrics]) => {
      const expectedMinimumExtractions = fixturePath ? Math.min(1, limit) : Math.min(5, limit);
      const retailerKey = Object.values(RETAILERS).find((config) => config.name === retailer)?.key;
      return [retailer, {
        ...metrics,
        sourcePolicy: retailerKey ? retailerSourcePolicies[retailerKey] : null,
        fallback: retailerKey && metrics.blockedRequests > 0 ? lawfulFallbackForBlockedSource(retailerKey) : null,
        alerts: buildScraperAlerts(metrics, expectedMinimumExtractions),
      }];
    })),
  };
  await mkdir(dirname(statusOutPath), { recursive: true });
  await writeFile(statusOutPath, JSON.stringify(status, null, 2));

  console.log(JSON.stringify({
    marketCode: "ZA",
    output: fixturePath ? resolve(fixturePath) : outPath,
    reviewQueue: reviewQueue.length > 0 ? reviewOutPath : null,
    status: statusOutPath,
    wroteToDatabase: shouldWrite,
    counts: Object.fromEntries(Object.entries(productsByRetailer).map(([retailer, products]) => [retailer, products.length])),
    quality: Object.fromEntries(Object.entries(qualityByRetailer).map(([retailer, quality]) => [retailer, {
      accepted: quality.accepted.length,
      rejected: quality.rejected.length,
      reviewQueued: quality.reviewQueue.length,
    }])),
    writeResults,
  }, null, 2));
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href) {
  main().catch(async (error) => {
    console.error(error);
    await closePool().catch(() => undefined);
    process.exitCode = 1;
  });
}
