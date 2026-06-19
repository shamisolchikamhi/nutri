import type { RetailerKey, RetailerListing } from "./types";

function objectsFromJsonLd(html: string) {
  const objects: Record<string, unknown>[] = [];
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const value = JSON.parse(match[1]) as unknown;
      const values = Array.isArray(value) ? value : [value];
      for (const item of values) {
        if (item && typeof item === "object") objects.push(item as Record<string, unknown>);
      }
    } catch {
      // Malformed structured blocks are ignored in favour of other blocks.
    }
  }
  return objects.flatMap((item) => Array.isArray(item.itemListElement) ? item.itemListElement.map((entry) => (entry as Record<string, unknown>).item ?? entry).filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object")) : [item]);
}

function number(value: unknown) {
  const parsed = Number.parseFloat(String(value ?? "").replace(/[^0-9.,]/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function pack(value: unknown, name: string) {
  const text = `${String(value ?? "")} ${name}`.toLowerCase();
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml|pack|each)/);
  if (!match) return { packSize: 1, packUnit: "unit" };
  return { packSize: Number.parseFloat(match[1].replace(",", ".")), packUnit: match[2] === "pack" || match[2] === "each" ? "unit" : match[2] };
}

export function parseStructuredListings(retailer: RetailerKey, html: string, sourceUrl: string) {
  return objectsFromJsonLd(html).flatMap((item): RetailerListing[] => {
    if (item["@type"] !== "Product") return [];
    const offers = (Array.isArray(item.offers) ? item.offers[0] : item.offers) as Record<string, unknown> | undefined;
    const name = String(item.name ?? "").trim();
    const price = number(offers?.price);
    if (!name || price == null || price <= 0) return [];
    const regularPrice = number(offers?.highPrice ?? item.regularPrice);
    const parsedPack = pack(item.size, name);
    const brand = typeof item.brand === "object" ? String((item.brand as Record<string, unknown>).name ?? "") : String(item.brand ?? "");
    return [{
      retailer,
      externalId: String(item.sku ?? item.productID ?? `${retailer}:${name.toLowerCase()}`),
      name,
      brand: brand || null,
      ...parsedPack,
      price,
      regularPrice: regularPrice && regularPrice > price ? regularPrice : null,
      currency: String(offers?.priceCurrency ?? "ZAR"),
      promotionType: regularPrice && regularPrice > price ? "single_price" : null,
      validFrom: typeof offers?.validFrom === "string" ? offers.validFrom : null,
      validUntil: typeof offers?.priceValidUntil === "string" ? offers.priceValidUntil : null,
      sourceUrl: String(item.url ?? sourceUrl),
      imageUrl: Array.isArray(item.image) ? String(item.image[0] ?? "") : String(item.image ?? ""),
    }];
  });
}
