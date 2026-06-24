# Retailer Source Policy

NutriBasket may read public retailer catalogue pages only when robots.txt, access controls, and retailer terms permit it. If a source blocks access, disallows catalogue paths, presents authentication/CAPTCHA gates, or becomes technically unreliable, direct scraping must stop for that retailer.

## Lawful Fallbacks

Use these fallback sources, in this order:

1. Retailer-approved product, price, or promotion feeds.
2. Affiliate or commercial catalogue providers with terms that permit product and price display.
3. Manual catalogue ingestion from operator-reviewed files, with source URL, valid dates, currency, and verification timestamp preserved.

Open Food Facts may be used for product identity and nutrition metadata, but not as a substitute for retailer shelf prices.

## Refresh Frequency

For public catalogue pages, refresh no more than hourly per retailer and apply the scraper delay between requests. Approved feeds or catalogue providers may use the refresh frequency stated in their contract. Manual catalogue uploads should carry the operator verification timestamp and should not be labeled live.

## Retailer Notes

| Retailer | Direct access | Permitted fallback | Refresh |
| --- | --- | --- | --- |
| Woolworths Food | Public catalogue pages only when permitted | Approved feed, catalogue provider, or manual ingestion | Hourly maximum unless a feed contract says otherwise |
| Pick n Pay | Public search/catalogue pages only when permitted | Approved feed, catalogue provider, or manual ingestion | Hourly maximum unless a feed contract says otherwise |
| Checkers | Public catalogue pages only when permitted | Approved feed, catalogue provider, or manual ingestion | Hourly maximum unless a feed contract says otherwise |

Blocked sources should appear in scraper status with `stop_direct_scraping` and a fallback type before any new records are published.
