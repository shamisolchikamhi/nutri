import { useEffect } from "react";
import { useLocation } from "wouter";
import { useGetProfile } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function IndexPage() {
  const [, setLocation] = useLocation();
  const { data: profile, isLoading, error } = useGetProfile({ query: { retry: false } as any });

  useEffect(() => {
    if (!isLoading) {
      if (error || !profile) {
        setLocation("/onboarding");
      } else {
        setLocation("/dashboard");
      }
    }
  }, [isLoading, error, profile, setLocation]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-leaf"><path d="M11 20A7 7 0 0 1 14 6c2 0 4 2 4 4 0 4-3 10-7 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>
        </div>
        <Skeleton className="h-6 w-32" />
      </div>
    </div>
  );
}
