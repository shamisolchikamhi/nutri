import { parseStructuredListings } from "./common";
import type { RetailerAdapter } from "./types";

export const woolworthsAdapter: RetailerAdapter = {
  key: "woolworths",
  parse(html, sourceUrl) {
    return parseStructuredListings("woolworths", html, sourceUrl);
  },
};
