import React, { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ProjectProvider } from "@/contexts/ProjectContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ContractsPage from "./pages/Contracts";
import PaymentsPage from "./pages/Payments";
import BudgetPage from "./pages/Budget";
import VendorsPage from "./pages/Vendors";
import InvoicesPage from "./pages/Invoices";
import DrawsPage from "./pages/Draws";
import SchedulePage from "./pages/Schedule";
import SettingsPage from "./pages/Settings";
import ClientUsers from "./pages/ClientUsers";
import ClientFiles from "./pages/ClientFiles";
import NotFound from "./pages/NotFound";

// COI Tracker pages
import COIIndex from "./coi-tracker/pages/Index";
import COIProjects from "./coi-tracker/pages/Projects";
import COIProjectDetail from "./coi-tracker/pages/ProjectDetail";
import COIFiles from "./coi-tracker/pages/Files";
import COISettings from "./coi-tracker/pages/Settings";

// Code Hub pages
import AskCodes from "./code-hub/pages/AskCodes";
import ManageSources from "./code-hub/pages/ManageSources";
import VendorDirectoryPage from "./pages/VendorDirectory";
import PackageTrack from "./pages/PackageTrack";
const InteriorsLedger = lazy(() => import("./pages/InteriorsLedger"));
import ClientCOI from "./pages/ClientCOI";
import ClientSubAgreements from "./pages/ClientSubAgreements";
import TrelloPage from "./pages/Trello";
import CalendarPage from "./pages/Calendar";
import Eula from "./pages/Eula";
import PrivacyPolicy from "./pages/PrivacyPolicy";

const queryClient = new QueryClient();

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function ClientRedirect({ children }: { children: React.ReactNode }) {
  const { isClient } = useAuth();
  if (isClient) return <Navigate to="/client/dashboard" replace />;
  return <>{children}</>;
}

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              {/* Public pages (no auth, no layout) */}
              <Route path="/login" element={<Login />} />
              <Route path="/eula" element={<Eula />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />

              {/* All app routes require auth */}
              <Route element={
                <AuthGuard>
                  <ProjectProvider>
                    <AppLayout />
                  </ProjectProvider>
                </AuthGuard>
              }>
                {/* Company-only routes (redirect clients to client hub) */}
                <Route path="/" element={<ClientRedirect><Dashboard /></ClientRedirect>} />
                <Route path="/contracts" element={<ClientRedirect><ContractsPage /></ClientRedirect>} />
                <Route path="/payments" element={<ClientRedirect><PaymentsPage /></ClientRedirect>} />
                <Route path="/budget" element={<ClientRedirect><BudgetPage /></ClientRedirect>} />
                <Route path="/vendors" element={<ClientRedirect><VendorsPage /></ClientRedirect>} />
                <Route path="/invoices" element={<ClientRedirect><InvoicesPage /></ClientRedirect>} />
                <Route path="/schedule" element={<ClientRedirect><SchedulePage /></ClientRedirect>} />
                <Route path="/draws" element={<ClientRedirect><DrawsPage /></ClientRedirect>} />
                <Route path="/settings" element={<ClientRedirect><SettingsPage /></ClientRedirect>} />

                {/* COI Tracker routes (company only) */}
                <Route path="/insurance" element={<ClientRedirect><COIIndex /></ClientRedirect>} />
                <Route path="/insurance/projects" element={<ClientRedirect><COIProjects /></ClientRedirect>} />
                <Route path="/insurance/projects/:id" element={<ClientRedirect><COIProjectDetail /></ClientRedirect>} />
                <Route path="/insurance/files" element={<ClientRedirect><COIFiles /></ClientRedirect>} />
                <Route path="/insurance/settings" element={<ClientRedirect><COISettings /></ClientRedirect>} />

                {/* Internal Hub (company only) */}
                <Route path="/trello" element={<ClientRedirect><TrelloPage /></ClientRedirect>} />
                <Route path="/calendar" element={<ClientRedirect><CalendarPage /></ClientRedirect>} />

                {/* Vendor Hub routes (company only) */}
                <Route path="/vendor-hub" element={<ClientRedirect><VendorDirectoryPage /></ClientRedirect>} />

                {/* Code Hub routes (company only) */}
                <Route path="/code" element={<ClientRedirect><AskCodes /></ClientRedirect>} />
                <Route path="/code/admin" element={<ClientRedirect><ManageSources /></ClientRedirect>} />

                {/* Interiors Hub routes (company only) */}
                <Route path="/interiors" element={<ClientRedirect><Suspense fallback={null}><InteriorsLedger /></Suspense></ClientRedirect>} />
                <Route path="/interiors/package-track" element={<ClientRedirect><PackageTrack /></ClientRedirect>} />

                {/* Client Hub routes (company: admin views, client: read-only project views) */}
                <Route path="/client" element={<ClientRedirect><ClientUsers /></ClientRedirect>} />
                <Route path="/client/files" element={<ClientFiles />} />
                <Route path="/client/dashboard" element={<Dashboard readOnly />} />
                <Route path="/client/budget" element={<BudgetPage readOnly />} />
                <Route path="/client/draws" element={<DrawsPage readOnly />} />
                <Route path="/client/schedule" element={<SchedulePage readOnly />} />
                <Route path="/client/coi" element={<ClientCOI />} />
                <Route path="/client/sub-agreements" element={<ClientSubAgreements />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
