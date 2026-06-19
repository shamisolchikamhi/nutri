import { parseStructuredListings } from "./common";
import type { RetailerAdapter } from "./types";

export const checkersAdapter: RetailerAdapter = {
  key: "checkers",
  parse(html, sourceUrl) {
    return parseStructuredListings("checkers", html, sourceUrl);
  },
};
