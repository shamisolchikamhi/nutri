import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import IndexPage from "@/pages/index";
import OnboardingPage from "@/pages/onboarding";
import DashboardPage from "@/pages/dashboard";
import TrackerPage from "@/pages/tracker";
import ActivityPage from "@/pages/tracker-activity";
import HistoryPage from "@/pages/tracker-history";
import RecipesPage from "@/pages/recipes";
import RecipeDetailPage from "@/pages/recipe-detail";
import MealPlanPage from "@/pages/meal-plan";
import BasketPage from "@/pages/basket";
import BasketDetailPage from "@/pages/basket-detail";
import SpecialsPage from "@/pages/specials";
import ProductsPage from "@/pages/products";
import ProgressPage from "@/pages/progress";
import SavedPage from "@/pages/saved";
import SettingsPage from "@/pages/settings";
import AppLayout from "@/components/layout/AppLayout";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={IndexPage} />
      <Route path="/onboarding" component={OnboardingPage} />

      <Route path="/dashboard">
        <AppLayout><DashboardPage /></AppLayout>
      </Route>
      <Route path="/tracker">
        <AppLayout><TrackerPage /></AppLayout>
      </Route>
      <Route path="/tracker/activity">
        <AppLayout><ActivityPage /></AppLayout>
      </Route>
      <Route path="/tracker/history">
        <AppLayout><HistoryPage /></AppLayout>
      </Route>
      <Route path="/recipes/:id">
        <AppLayout><RecipeDetailPage /></AppLayout>
      </Route>
      <Route path="/recipes">
        <AppLayout><RecipesPage /></AppLayout>
      </Route>
      <Route path="/meal-plan">
        <AppLayout><MealPlanPage /></AppLayout>
      </Route>
      <Route path="/basket/:id">
        <AppLayout><BasketDetailPage /></AppLayout>
      </Route>
      <Route path="/basket">
        <AppLayout><BasketPage /></AppLayout>
      </Route>
      <Route path="/specials">
        <AppLayout><SpecialsPage /></AppLayout>
      </Route>
      <Route path="/products">
        <AppLayout><ProductsPage /></AppLayout>
      </Route>
      <Route path="/progress">
        <AppLayout><ProgressPage /></AppLayout>
      </Route>
      <Route path="/saved">
        <AppLayout><SavedPage /></AppLayout>
      </Route>
      <Route path="/settings">
        <AppLayout><SettingsPage /></AppLayout>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
