import { parseStructuredListings } from "./common";
import type { RetailerAdapter } from "./types";

export const pickNPayAdapter: RetailerAdapter = {
  key: "pick-n-pay",
  parse(html, sourceUrl) {
    return parseStructuredListings("pick-n-pay", html, sourceUrl);
  },
};
