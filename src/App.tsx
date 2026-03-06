import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProjectProvider } from "@/contexts/ProjectContext";
import { AuthProvider } from "@/coi-tracker/context/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import ContractsPage from "./pages/Contracts";
import PaymentsPage from "./pages/Payments";
import BudgetPage from "./pages/Budget";
import VendorsPage from "./pages/Vendors";
import DrawsPage from "./pages/Draws";
import SettingsPage from "./pages/Settings";
import NotFound from "./pages/NotFound";

// COI Tracker pages
import COILogin from "./coi-tracker/pages/Login";
import COIIndex from "./coi-tracker/pages/Index";
import COIProjects from "./coi-tracker/pages/Projects";
import COIProjectDetail from "./coi-tracker/pages/ProjectDetail";
import COIFiles from "./coi-tracker/pages/Files";
import COISettings from "./coi-tracker/pages/Settings";

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <ProjectProvider>
              <Routes>
                {/* COI tracker login (outside Hub layout — full screen) */}
                <Route path="/insurance/login" element={<COILogin />} />

                {/* Hub layout wraps everything else */}
                <Route element={<AppLayout />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/contracts" element={<ContractsPage />} />
                  <Route path="/payments" element={<PaymentsPage />} />
                  <Route path="/budget" element={<BudgetPage />} />
                  <Route path="/vendors" element={<VendorsPage />} />
                  <Route path="/draws" element={<DrawsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />

                  {/* COI Tracker routes */}
                  <Route path="/insurance" element={<COIIndex />} />
                  <Route path="/insurance/projects" element={<COIProjects />} />
                  <Route path="/insurance/projects/:id" element={<COIProjectDetail />} />
                  <Route path="/insurance/files" element={<COIFiles />} />
                  <Route path="/insurance/settings" element={<COISettings />} />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </ProjectProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
