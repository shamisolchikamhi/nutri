import { 
  Home, 
  Activity, 
  Utensils, 
  ShoppingCart, 
  Tag, 
  LineChart, 
  Settings, 
  Bookmark,
  Search,
  History
} from "lucide-react";
import { Link, useLocation } from "wouter";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";

const navItems = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: Home,
  },
  {
    title: "Tracker",
    url: "/tracker",
    icon: Activity,
  },
  {
    title: "History",
    url: "/tracker/history",
    icon: History,
  },
  {
    title: "Recipes",
    url: "/recipes",
    icon: Utensils,
  },
  {
    title: "Basket",
    url: "/basket",
    icon: ShoppingCart,
  },
  {
    title: "Specials",
    url: "/specials",
    icon: Tag,
  },
  {
    title: "Products",
    url: "/products",
    icon: Search,
  },
  {
    title: "Progress",
    url: "/progress",
    icon: LineChart,
  },
  {
    title: "Saved",
    url: "/saved",
    icon: Bookmark,
  },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-4">
        <Link href="/dashboard" className="flex items-center gap-2 font-bold text-xl tracking-tight text-primary">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-leaf"><path d="M11 20A7 7 0 0 1 14 6c2 0 4 2 4 4 0 4-3 10-7 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>
          </div>
          NutriBasket
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = location === item.url || (item.url !== "/" && location.startsWith(item.url + "/"));
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={location.startsWith("/settings")}>
              <Link href="/settings">
                <Settings />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
