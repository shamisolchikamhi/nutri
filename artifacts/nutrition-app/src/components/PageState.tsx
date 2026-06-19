import type { ReactNode } from "react";
import { AlertCircle, Inbox } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

type ErrorStateProps = {
  reference: string;
  onRetry: () => void;
  title?: string;
  description?: string;
  isRetrying?: boolean;
};

export function PageError({ reference, onRetry, title = "We couldn't load this page", description = "Your data is still safe. Check your connection and try again.", isRetrying = false }: ErrorStateProps) {
  return (
    <Empty className="min-h-64 border" role="alert">
      <EmptyHeader>
        <EmptyMedia variant="icon"><AlertCircle /></EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={onRetry} disabled={isRetrying}>{isRetrying ? "Trying again..." : "Try again"}</Button>
        <p className="text-xs text-muted-foreground">Support reference: <span className="font-mono">{reference}</span></p>
      </EmptyContent>
    </Empty>
  );
}

export function PageEmpty({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <Empty className="min-h-64 border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon"><Inbox /></EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  );
}

export function PageLoading({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-4" aria-label="Loading page data" aria-busy="true">
      {Array.from({ length: rows }, (_, index) => <Skeleton key={index} className="h-28 rounded-xl" />)}
    </div>
  );
}
