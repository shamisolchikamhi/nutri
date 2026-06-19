export type RetailerKey = "woolworths" | "pick-n-pay" | "checkers";

export type RetailerListing = {
  retailer: RetailerKey;
  externalId: string;
  name: string;
  brand: string | null;
  packSize: number;
  packUnit: string;
  price: number;
  regularPrice: number | null;
  currency: string;
  promotionType: "single_price" | "percentage" | "multibuy" | "loyalty" | null;
  validFrom: string | null;
  validUntil: string | null;
  sourceUrl: string;
  imageUrl: string;
};

export type RetailerAdapter = {
  key: RetailerKey;
  parse(html: string, sourceUrl: string): RetailerListing[];
};
