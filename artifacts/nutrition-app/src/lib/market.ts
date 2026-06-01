export type MarketCode = "ZA" | "AU" | "GB" | "US";

export type MarketConfig = {
  code: MarketCode;
  name: string;
  locale: string;
  currencyCode: string;
  weightUnit: "kg" | "lb";
  distanceUnit: "km" | "mi";
};

export const MARKETS: Record<MarketCode, MarketConfig> = {
  ZA: {
    code: "ZA",
    name: "South Africa",
    locale: "en-ZA",
    currencyCode: "ZAR",
    weightUnit: "kg",
    distanceUnit: "km",
  },
  AU: {
    code: "AU",
    name: "Australia",
    locale: "en-AU",
    currencyCode: "AUD",
    weightUnit: "kg",
    distanceUnit: "km",
  },
  GB: {
    code: "GB",
    name: "United Kingdom",
    locale: "en-GB",
    currencyCode: "GBP",
    weightUnit: "kg",
    distanceUnit: "mi",
  },
  US: {
    code: "US",
    name: "United States",
    locale: "en-US",
    currencyCode: "USD",
    weightUnit: "lb",
    distanceUnit: "mi",
  },
};

const DEFAULT_MARKET_CODE = "ZA";

function isMarketCode(value: string | undefined): value is MarketCode {
  return !!value && value in MARKETS;
}

export function getActiveMarket(): MarketConfig {
  const envMarket = import.meta.env.VITE_DEFAULT_MARKET;
  const storedMarket =
    typeof window !== "undefined" ? window.localStorage.getItem("nutri:market") ?? undefined : undefined;

  if (isMarketCode(storedMarket)) return MARKETS[storedMarket];
  if (isMarketCode(envMarket)) return MARKETS[envMarket];
  return MARKETS[DEFAULT_MARKET_CODE];
}

export function setActiveMarket(code: MarketCode) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem("nutri:market", code);
  }
}

export function formatMoney(value: number | null | undefined, market = getActiveMarket()) {
  const amount = value ?? 0;
  return new Intl.NumberFormat(market.locale, {
    style: "currency",
    currency: market.currencyCode,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export function getBudgetLabel(market = getActiveMarket()) {
  return `Weekly budget (${market.currencyCode})`;
}
