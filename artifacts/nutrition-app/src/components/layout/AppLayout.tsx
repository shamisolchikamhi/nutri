import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Link, useLocation } from "wouter";
import { Activity, Bot, CalendarDays, Home, ShoppingCart } from "lucide-react";

const PAGE_TITLES = [
  ["/dashboard", "Dashboard"],
  ["/tracker", "Track"],
  ["/recipes", "Recipes"],
  ["/meal-plan", "Meal Plan"],
  ["/pantry", "Pantry"],
  ["/agent", "Nutri Agent"],
  ["/basket", "Shop"],
  ["/products", "Products"],
  ["/specials", "Specials"],
  ["/settings", "Settings"],
] as const;

const MOBILE_NAV = [
  { title: "Home", url: "/dashboard", icon: Home },
  { title: "Track", url: "/tracker", icon: Activity },
  { title: "Agent", url: "/agent", icon: Bot },
  { title: "Plan", url: "/meal-plan", icon: CalendarDays },
  { title: "Shop", url: "/basket", icon: ShoppingCart },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const pageTitle = PAGE_TITLES.find(([path]) => location === path || location.startsWith(`${path}/`))?.[1] ?? "NutriBasket";
  const dateLabel = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" }).format(new Date());

  return (
    <SidebarProvider className="bg-transparent">
      <AppSidebar />
      <SidebarInset className="bg-transparent">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-white/70 bg-background/75 px-4 shadow-[0_1px_12px_rgba(15,23,42,0.035)] backdrop-blur-xl md:px-7">
          <SidebarTrigger className="bg-card/80 shadow-sm" />
          <div className="flex w-full items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary/70">NutriBasket</p>
              <p className="text-base font-semibold tracking-tight">{pageTitle}</p>
            </div>
            <div className="rounded-full border border-white/80 bg-card/70 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
              {dateLabel}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto px-4 pb-32 pt-5 md:px-8 md:pb-16 md:pt-8">
          <div className="mx-auto w-full max-w-6xl animate-in fade-in duration-300">
            {children}
          </div>
        </main>
        <nav aria-label="Primary mobile navigation" className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 rounded-2xl border border-white/70 bg-card/90 p-1.5 shadow-[0_16px_45px_rgba(15,23,42,0.18)] backdrop-blur-xl md:hidden">
          {MOBILE_NAV.map((item) => {
            const active = location === item.url || location.startsWith(`${item.url}/`);
            return (
              <Link key={item.url} href={item.url} aria-current={active ? "page" : undefined} className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold transition-colors ${active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted"}`}>
                <item.icon className="h-4 w-4" />
                <span>{item.title}</span>
              </Link>
            );
          })}
        </nav>
      </SidebarInset>
    </SidebarProvider>
  );
}
