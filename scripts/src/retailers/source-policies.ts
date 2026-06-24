import type { RetailerKey } from "./types";

export type RetailerSourcePolicy = {
  retailer: RetailerKey;
  directScraping: "public_pages_only";
  permittedRefreshFrequency: string;
  approvedFallbacks: Array<"retailer_feed" | "affiliate_catalogue_provider" | "manual_catalogue_ingestion">;
  termsNote: string;
};

export const retailerSourcePolicies: Record<RetailerKey, RetailerSourcePolicy> = {
  woolworths: {
    retailer: "woolworths",
    directScraping: "public_pages_only",
    permittedRefreshFrequency: "No more than hourly; obey robots.txt and HTTP blocking signals.",
    approvedFallbacks: ["retailer_feed", "affiliate_catalogue_provider", "manual_catalogue_ingestion"],
    termsNote: "Use public catalogue pages only when permitted. Prefer an approved feed or catalogue provider for production refreshes.",
  },
  "pick-n-pay": {
    retailer: "pick-n-pay",
    directScraping: "public_pages_only",
    permittedRefreshFrequency: "No more than hourly; obey robots.txt and HTTP blocking signals.",
    approvedFallbacks: ["retailer_feed", "affiliate_catalogue_provider", "manual_catalogue_ingestion"],
    termsNote: "Use public search/catalogue pages only when permitted. Prefer retailer-approved commercial data sources for live prices.",
  },
  checkers: {
    retailer: "checkers",
    directScraping: "public_pages_only",
    permittedRefreshFrequency: "No more than hourly; obey robots.txt and HTTP blocking signals.",
    approvedFallbacks: ["retailer_feed", "affiliate_catalogue_provider", "manual_catalogue_ingestion"],
    termsNote: "Use public catalogue pages only when permitted. Fall back to manual or provider catalogues if access is blocked.",
  },
};

export function lawfulFallbackForBlockedSource(retailer: RetailerKey) {
  const policy = retailerSourcePolicies[retailer];
  return {
    retailer,
    action: "stop_direct_scraping",
    fallback: policy.approvedFallbacks[0] ?? "manual_catalogue_ingestion",
    permittedRefreshFrequency: policy.permittedRefreshFrequency,
    note: policy.termsNote,
  };
}
