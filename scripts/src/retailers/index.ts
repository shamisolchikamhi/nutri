import { checkersAdapter } from "./checkers";
import { pickNPayAdapter } from "./pick-n-pay";
import { woolworthsAdapter } from "./woolworths";
import type { RetailerAdapter, RetailerKey } from "./types";

export const retailerAdapters: Record<RetailerKey, RetailerAdapter> = {
  woolworths: woolworthsAdapter,
  "pick-n-pay": pickNPayAdapter,
  checkers: checkersAdapter,
};

export type { RetailerKey, RetailerListing } from "./types";
