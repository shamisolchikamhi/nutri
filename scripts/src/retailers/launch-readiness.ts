export type RetailerLaunchSignal = {
  retailer: string;
  scheduledExtractionSucceeded: boolean;
  reliabilityDays: number;
  hasFreshness: boolean;
  hasExpiry: boolean;
  hasProvenance: boolean;
  hasMonitoring: boolean;
};

export function evaluateLiveDataLaunch(signals: RetailerLaunchSignal[]) {
  const readyRetailers = signals.filter((signal) =>
    signal.scheduledExtractionSucceeded &&
    signal.reliabilityDays >= 7 &&
    signal.hasFreshness &&
    signal.hasExpiry &&
    signal.hasProvenance &&
    signal.hasMonitoring
  );
  const reasons: string[] = [];

  if (readyRetailers.length < 2) reasons.push("fewer than two retailers have passed scheduled extraction readiness");
  for (const signal of signals) {
    if (!signal.scheduledExtractionSucceeded) reasons.push(`${signal.retailer}: scheduled extraction has not succeeded`);
    if (signal.reliabilityDays < 7) reasons.push(`${signal.retailer}: seven-day reliability run incomplete`);
    if (!signal.hasFreshness) reasons.push(`${signal.retailer}: freshness coverage missing`);
    if (!signal.hasExpiry) reasons.push(`${signal.retailer}: expiry coverage missing`);
    if (!signal.hasProvenance) reasons.push(`${signal.retailer}: provenance coverage missing`);
    if (!signal.hasMonitoring) reasons.push(`${signal.retailer}: monitoring coverage missing`);
  }

  return {
    canEnableLiveBadge: readyRetailers.length >= 2,
    displayLabel: readyRetailers.length >= 2 ? "Live prices" : "Recently observed prices",
    readyRetailers: readyRetailers.map((signal) => signal.retailer),
    reasons,
  };
}
