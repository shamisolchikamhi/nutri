import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

type MarketCode = "ZA" | "AU" | "GB" | "US";

type ScrapeConfig = {
  marketCode: MarketCode;
  countryTag: string;
  retailerName: string;
  currencyCode: string;
  queries: string[];
};

type OpenFoodFactsProduct = {
  code?: string;
  product_name?: string;
  product_name_en?: string;
  generic_name?: string;
  brands?: string;
  categories?: string;
  categories_tags?: string[];
  quantity?: string;
  image_url?: string;
  url?: string;
  nutriments?: Record<string, number | string | undefined>;
};

type OpenFoodFactsSearchResponse = {
  products?: OpenFoodFactsProduct[];
};

type NormalizedProduct = {
  externalId: string;
  sourceUrl: string | null;
  name: string;
  brand: string | null;
  category: string;
  priceAud: number;
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

const CONFIG_BY_MARKET: Record<MarketCode, ScrapeConfig> = {
  ZA: {
    marketCode: "ZA",
    countryTag: "south-africa",
    retailerName: "Open Food Facts ZA",
    currencyCode: "ZAR",
    queries: ["chicken", "yoghurt", "oats", "rice", "beans", "tuna", "milk", "peanut butter"],
  },
  AU: {
    marketCode: "AU",
    countryTag: "australia",
    retailerName: "Open Food Facts AU",
    currencyCode: "AUD",
    queries: ["chicken", "yoghurt", "oats", "rice", "beans", "tuna", "milk", "peanut butter"],
  },
  GB: {
    marketCode: "GB",
    countryTag: "united-kingdom",
    retailerName: "Open Food Facts UK",
    currencyCode: "GBP",
    queries: ["chicken", "yoghurt", "oats", "rice", "beans", "tuna", "milk", "peanut butter"],
  },
  US: {
    marketCode: "US",
    countryTag: "united-states",
    retailerName: "Open Food Facts US",
    currencyCode: "USD",
    queries: ["chicken", "yogurt", "oats", "rice", "beans", "tuna", "milk", "peanut butter"],
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseMarketCode(value: string | undefined): MarketCode {
  const marketCode = (value ?? "ZA").toUpperCase();
  if (marketCode === "ZA" || marketCode === "AU" || marketCode === "GB" || marketCode === "US") {
    return marketCode;
  }
  throw new Error(`Unsupported market "${value}". Use one of: ZA, AU, GB, US.`);
}

function num(value: number | string | undefined): number | null {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanName(product: OpenFoodFactsProduct): string | null {
  const name = product.product_name_en ?? product.product_name ?? product.generic_name;
  const cleaned = name?.replace(/\s+/g, " ").trim();
  return cleaned && cleaned.length > 2 ? cleaned : null;
}

function mapCategory(product: OpenFoodFactsProduct): string {
  const joined = [
    product.categories ?? "",
    ...(product.categories_tags ?? []),
  ].join(" ").toLowerCase();

  if (/(chicken|beef|fish|tuna|egg|meat|protein|legume|lentil|bean)/.test(joined)) return "protein";
  if (/(milk|yoghurt|yogurt|cheese|dairy)/.test(joined)) return "dairy";
  if (/(rice|oat|pasta|bread|cereal|grain)/.test(joined)) return "grains";
  if (/(fruit|vegetable|veg|produce)/.test(joined)) return "fruit_veg";
  if (/(snack|chips|biscuit|bar|chocolate)/.test(joined)) return "snacks";
  if (/(drink|juice|beverage|water)/.test(joined)) return "drinks";
  if (/(sauce|spice|condiment)/.test(joined)) return "condiments";
  if (/(frozen)/.test(joined)) return "frozen";
  return "pantry";
}

function parsePack(quantity: string | undefined): { packSize: number; packUnit: string } {
  const match = quantity?.toLowerCase().match(/([\d,.]+)\s*(kg|g|l|ml|unit|pack|pcs?)/);
  if (!match) return { packSize: 1, packUnit: "unit" };

  const amount = Number.parseFloat(match[1].replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0) return { packSize: 1, packUnit: "unit" };

  const unit = match[2];
  if (unit === "g") return { packSize: amount / 1000, packUnit: "kg" };
  if (unit === "ml") return { packSize: amount / 1000, packUnit: "l" };
  if (unit === "pcs") return { packSize: amount, packUnit: "unit" };
  return { packSize: amount, packUnit: unit };
}

function estimateTestPrice(product: Pick<NormalizedProduct, "category" | "packSize" | "proteinPer100g">, market: ScrapeConfig) {
  const categoryBaseZar: Record<string, number> = {
    protein: 75,
    dairy: 38,
    grains: 32,
    fruit_veg: 28,
    snacks: 25,
    drinks: 20,
    condiments: 34,
    frozen: 55,
    pantry: 30,
    other: 30,
  };
  const currencyMultiplier: Record<string, number> = {
    ZAR: 1,
    AUD: 0.085,
    GBP: 0.043,
    USD: 0.055,
  };
  const base = categoryBaseZar[product.category] ?? categoryBaseZar.other;
  const packMultiplier = Math.min(3, Math.max(0.6, product.packSize || 1));
  const proteinPremium = product.proteinPer100g >= 15 ? 1.18 : 1;
  return Math.round(base * packMultiplier * proteinPremium * currencyMultiplier[market.currencyCode] * 100) / 100;
}

function normalize(product: OpenFoodFactsProduct, market: ScrapeConfig): NormalizedProduct | null {
  const name = cleanName(product);
  if (!name || !product.code) return null;

  const calories = num(product.nutriments?.["energy-kcal_100g"]) ?? num(product.nutriments?.["energy-kcal"]) ?? 0;
  const protein = num(product.nutriments?.proteins_100g) ?? 0;
  const carbs = num(product.nutriments?.carbohydrates_100g) ?? 0;
  const fat = num(product.nutriments?.fat_100g) ?? 0;
  if (calories <= 0 && protein <= 0 && carbs <= 0 && fat <= 0) return null;

  const pack = parsePack(product.quantity);
  const normalized = {
    externalId: product.code,
    sourceUrl: product.url ?? null,
    name,
    brand: product.brands?.split(",")[0]?.trim() || null,
    category: mapCategory(product),
    priceAud: 0,
    packSize: pack.packSize,
    packUnit: pack.packUnit,
    caloriesPer100g: Math.round(calories),
    proteinPer100g: Math.round(protein * 10) / 10,
    carbsPer100g: Math.round(carbs * 10) / 10,
    fatPer100g: Math.round(fat * 10) / 10,
    fiberPer100g: num(product.nutriments?.fiber_100g),
    sugarPer100g: num(product.nutriments?.sugars_100g),
    imageUrl: product.image_url ?? "",
  };

  return {
    ...normalized,
    priceAud: estimateTestPrice(normalized, market),
  };
}

async function fetchProductsForQuery(query: string, market: ScrapeConfig, pageSize: number) {
  const url = new URL("https://world.openfoodfacts.org/api/v2/search");
  url.searchParams.set("search_terms", query);
  url.searchParams.set("page_size", String(pageSize));
  url.searchParams.set("countries_tags", market.countryTag);
  url.searchParams.set("fields", [
    "code",
    "product_name",
    "product_name_en",
    "generic_name",
    "brands",
    "categories",
    "categories_tags",
    "quantity",
    "image_url",
    "url",
    "nutriments",
  ].join(","));

  let lastStatus = 0;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "NutriBasket/0.1 - development data importer",
        "Accept": "application/json",
      },
    });

    if (response.ok) {
      const data = (await response.json()) as OpenFoodFactsSearchResponse;
      return data.products ?? [];
    }

    lastStatus = response.status;
    if (response.status !== 429 && response.status !== 503) break;
    await sleep(attempt * 1500);
  }

  throw new Error(`Open Food Facts search failed for "${query}" (${lastStatus})`);
}

async function getOrCreateRetailer(market: ScrapeConfig) {
  const [{ and, eq }, { db, retailersTable }] = await Promise.all([
    import("drizzle-orm"),
    import("@workspace/db"),
  ]);

  const existing = await db
    .select()
    .from(retailersTable)
    .where(and(eq(retailersTable.name, market.retailerName), eq(retailersTable.marketCode, market.marketCode)))
    .limit(1);

  if (existing[0]) return existing[0];

  const [created] = await db
    .insert(retailersTable)
    .values({
      name: market.retailerName,
      marketCode: market.marketCode,
      logoUrl: "",
      isActive: true,
    })
    .returning();

  return created;
}

async function writeProducts(products: NormalizedProduct[], market: ScrapeConfig) {
  const [{ and, eq }, { db, productsTable, pool }] = await Promise.all([
    import("drizzle-orm"),
    import("@workspace/db"),
  ]);
  const retailer = await getOrCreateRetailer(market);
  let inserted = 0;
  let updated = 0;

  for (const product of products) {
    const existing = await db
      .select()
      .from(productsTable)
      .where(and(eq(productsTable.name, product.name), eq(productsTable.retailerId, retailer.id)))
      .limit(1);

    const values = {
      name: product.name,
      brand: product.brand,
      retailerId: retailer.id,
      category: product.category,
      priceAud: product.priceAud,
      regularPriceAud: null,
      packSize: product.packSize,
      packUnit: product.packUnit,
      caloriesPer100g: product.caloriesPer100g,
      proteinPer100g: product.proteinPer100g,
      carbsPer100g: product.carbsPer100g,
      fatPer100g: product.fatPer100g,
      fiberPer100g: product.fiberPer100g,
      sugarPer100g: product.sugarPer100g,
      isOnSpecial: false,
      imageUrl: product.imageUrl,
    };

    if (existing[0]) {
      await db.update(productsTable).set(values).where(eq(productsTable.id, existing[0].id));
      updated += 1;
    } else {
      await db.insert(productsTable).values(values);
      inserted += 1;
    }
  }

  await pool.end();

  return { inserted, updated, retailerId: retailer.id };
}

async function main() {
  const marketCode = parseMarketCode(getArg("market"));
  const market = CONFIG_BY_MARKET[marketCode];
  const limit = Number.parseInt(getArg("limit", "80") ?? "80", 10);
  const pageSize = Math.max(5, Math.ceil(limit / market.queries.length));
  const shouldWrite = hasFlag("write");
  const fixturePath = getArg("from");
  const outPath = resolve(getArg("out", `scripts/out/open-food-facts-${marketCode}.json`) ?? "");

  let products: NormalizedProduct[];
  let output = outPath;
  if (fixturePath) {
    const fixture = JSON.parse(await readFile(resolve(fixturePath), "utf8")) as { products?: NormalizedProduct[] };
    products = fixture.products ?? [];
    output = resolve(fixturePath);
  } else {
    const byCode = new Map<string, NormalizedProduct>();
    for (const query of market.queries) {
      let rawProducts: OpenFoodFactsProduct[] = [];
      try {
        rawProducts = await fetchProductsForQuery(query, market, pageSize);
      } catch (error) {
        console.warn(error instanceof Error ? error.message : error);
        continue;
      }
      for (const rawProduct of rawProducts) {
        const product = normalize(rawProduct, market);
        if (product && !byCode.has(product.externalId)) {
          byCode.set(product.externalId, product);
        }
        if (byCode.size >= limit) break;
      }
      if (byCode.size >= limit) break;
      await sleep(800);
    }

    products = [...byCode.values()];
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(
      outPath,
      JSON.stringify({
        source: "Open Food Facts",
        sourceUrl: "https://world.openfoodfacts.org",
        marketCode,
        currencyCode: market.currencyCode,
        note: "Nutrition/product metadata is sourced from Open Food Facts. Prices are deterministic test estimates until retailer price feeds are connected.",
        scrapedAt: new Date().toISOString(),
        products,
      }, null, 2),
    );
  }

  let writeResult: Awaited<ReturnType<typeof writeProducts>> | null = null;
  if (shouldWrite) {
    writeResult = await writeProducts(products, market);
  }

  console.log(JSON.stringify({
    marketCode,
    fetched: products.length,
    output,
    wroteToDatabase: shouldWrite,
    ...writeResult,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
