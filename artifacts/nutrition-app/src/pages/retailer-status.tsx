import { useGetRetailerStatus } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Database } from "lucide-react";
import { PageEmpty, PageError } from "@/components/PageState";

const statusVariant = {
  healthy: "default",
  watch: "secondary",
  stale: "destructive",
  unverified: "outline",
} as const;

function verifiedLabel(hours: number | null) {
  if (hours == null) return "Verification pending";
  if (hours < 1) return "Verified under 1 hour ago";
  if (hours === 1) return "Verified 1 hour ago";
  return `Verified ${hours} hours ago`;
}

export default function RetailerStatusPage() {
  const statusQuery = useGetRetailerStatus();
  const status = statusQuery.data;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Database className="h-6 w-6 text-primary" /> Retailer Data Status
        </h1>
        <p className="text-sm text-muted-foreground">Operator view for scrape freshness, product coverage, and promotion publishing health.</p>
      </div>

      {statusQuery.isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[1, 2, 3].map((item) => <Skeleton key={item} className="h-40 rounded-xl" />)}
        </div>
      ) : statusQuery.isError ? (
        <PageError reference="DATA-RETAILER-STATUS" onRetry={() => void statusQuery.refetch()} isRetrying={statusQuery.isFetching} />
      ) : !status || status.retailers.length === 0 ? (
        <PageEmpty title="No retailer data yet" description="Run the retailer scraper to populate operator status." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {status.retailers.map((retailer) => (
            <Card key={retailer.retailerId}>
              <CardHeader className="space-y-2 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{retailer.retailerName}</CardTitle>
                    <p className="text-xs text-muted-foreground">{retailer.marketCode} / {retailer.channel}</p>
                  </div>
                  <Badge variant={statusVariant[retailer.status]} className="capitalize">{retailer.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted-foreground">{verifiedLabel(retailer.verifiedHoursAgo)}</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg border p-2">
                    <p className="text-lg font-semibold">{retailer.productCount}</p>
                    <p className="text-xs text-muted-foreground">Products</p>
                  </div>
                  <div className="rounded-lg border p-2">
                    <p className="text-lg font-semibold">{retailer.activePromotionCount}</p>
                    <p className="text-xs text-muted-foreground">Active promos</p>
                  </div>
                  <div className="rounded-lg border p-2">
                    <p className="text-lg font-semibold">{retailer.stalePromotionCount}</p>
                    <p className="text-xs text-muted-foreground">Stale promos</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Last scraped: {retailer.scrapedAt ? new Date(retailer.scrapedAt).toLocaleString() : "Not recorded"}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
