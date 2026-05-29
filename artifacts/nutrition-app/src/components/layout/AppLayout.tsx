import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Link } from "wouter";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <SidebarTrigger />
          <div className="w-full flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-lg tracking-tight md:hidden">NutriBasket</span>
            </div>
            <div className="flex items-center gap-2">
              {/* Future header items like user menu could go here */}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6 pb-24">
          <div className="mx-auto max-w-5xl w-full">
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
