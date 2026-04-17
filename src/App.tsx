import { lazy, Suspense } from "react";
import type { ReactNode } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/query-config";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { I18nProvider } from "@/contexts/I18nContext";
import { BrandingProvider } from "@/contexts/BrandingContext";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import { hasModuleAccess } from "@/lib/permissions";
import AppLayout from "@/components/layout/AppLayout";
import CookieConsentBanner from "@/components/CookieConsentBanner";
import ErrorBoundary from "@/components/ErrorBoundary";
import AppErrorBoundary from "@/components/shared/AppErrorBoundary";
// Route-level code splitting: each page loads on-demand
const PWAUpdateNotification = lazy(() =>
  import("@/components/pwa/PWAUpdateNotification").then((m) => ({
    default: m.PWAUpdateNotification,
  })),
);
const PWAInstallPrompt = lazy(() =>
  import("@/components/pwa/PWAInstallPrompt").then((m) => ({
    default: m.PWAInstallPrompt,
  })),
);
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const ResetPasswordPage = lazy(() => import("@/pages/ResetPasswordPage"));
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const LiveViewPage = lazy(() => import("@/pages/LiveViewPage"));
const ReverseFleetPage = lazy(() => import("@/pages/ReverseFleetPage"));
const VisionHubPage = lazy(() => import("@/pages/vision-hub/VisionHubPage"));
const PlaybackPage = lazy(() => import("@/pages/PlaybackPage"));
const EventsPage = lazy(() => import("@/pages/EventsPage"));
const IncidentsPage = lazy(() => import("@/pages/IncidentsPage"));
const DevicesPage = lazy(() => import("@/pages/DevicesPage"));
const SitesPage = lazy(() => import("@/pages/SitesPage"));
const AIAssistantPage = lazy(() => import("@/pages/AIAssistantPage"));
const IntegrationsPage = lazy(() => import("@/pages/IntegrationsPage"));
const ReportsPage = lazy(() => import("@/pages/ReportsPage"));
const AuditPage = lazy(() => import("@/pages/AuditPage"));
const SystemHealthPage = lazy(() => import("@/pages/SystemHealthPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const AdminPage = lazy(() => import("@/pages/AdminPage"));
const DomoticsPage = lazy(() => import("@/pages/DomoticsPage"));
const AccessControlPage = lazy(() => import("@/pages/AccessControlPage"));
const AccessDoorsPage = lazy(() => import("@/pages/AccessDoorsPage"));
const LiveStreamsPage = lazy(() => import("@/pages/LiveStreamsPage"));
const RebootsPage = lazy(() => import("@/pages/RebootsPage"));
const IntercomPage = lazy(() => import("@/pages/IntercomPage"));
const DatabasePage = lazy(() => import("@/pages/DatabasePage"));
const WhatsAppPage = lazy(() => import("@/pages/WhatsAppPage"));
const AlertsPage = lazy(() => import("@/pages/AlertsPage"));
const NotificationTemplatesPage = lazy(
  () => import("@/pages/NotificationTemplatesPage"),
);
const ShiftsPage = lazy(() => import("@/pages/ShiftsPage"));
const SLAPage = lazy(() => import("@/pages/SLAPage"));
const EmergencyPage = lazy(() => import("@/pages/EmergencyPage"));
const PatrolsPage = lazy(() => import("@/pages/PatrolsPage"));
const ScheduledReportsPage = lazy(() => import("@/pages/ScheduledReportsPage"));
const AutomationPage = lazy(() => import("@/pages/AutomationPage"));
const VisitorsPage = lazy(() => import("@/pages/VisitorsPage"));
const AnalyticsPage = lazy(() => import("@/pages/AnalyticsPage"));
const ContractsPage = lazy(() => import("@/pages/ContractsPage"));
const KeysPage = lazy(() => import("@/pages/KeysPage"));
const CompliancePage = lazy(() => import("@/pages/CompliancePage"));
const TrainingPage = lazy(() => import("@/pages/TrainingPage"));
const Immersive3DPage = lazy(() => import("@/pages/Immersive3DPage"));
const BiogeneticSearchPage = lazy(() => import("@/pages/BiogeneticSearchPage"));
const PredictiveCriminologyPage = lazy(
  () => import("@/pages/PredictiveCriminologyPage"),
);
const PostsPage = lazy(() => import("@/pages/PostsPage"));
const NotesPage = lazy(() => import("@/pages/NotesPage"));
const DocumentsPage = lazy(() => import("@/pages/DocumentsPage"));
const MinutaPage = lazy(() => import("@/pages/MinutaPage"));
const PhonePanelPage = lazy(() => import("@/pages/PhonePanelPage"));
const NetworkPage = lazy(() => import("@/pages/NetworkPage"));
const RemoteAccessPage = lazy(() => import("@/pages/RemoteAccessPage"));
const OperationsPanelPage = lazy(() => import("@/pages/OperationsPanelPage"));
const GuardMobilePage = lazy(() => import("@/pages/GuardMobilePage"));
const OnboardingWizardPage = lazy(() => import("@/pages/OnboardingWizardPage"));
const OperationalDashboardPage = lazy(
  () => import("@/pages/OperationalDashboardPage"),
);
const ResidentsAdminPage = lazy(() => import("@/pages/ResidentsAdminPage"));
const UserManualPage = lazy(() => import("@/pages/UserManualPage"));
const FloorPlanPage = lazy(() => import("@/pages/FloorPlanPage"));
const SkillsPage = lazy(() => import("@/pages/SkillsPage"));
const CameraHealthPage = lazy(() => import("@/pages/CameraHealthPage"));
const AgentView = lazy(() => import("@/features/agent/components/AgentView"));
const LandingPage = lazy(() => import("@/pages/LandingPage"));
const PrivacyPolicyPage = lazy(() => import("@/pages/PrivacyPolicyPage"));
const TermsPage = lazy(() => import("@/pages/TermsPage"));
const CookiePolicyPage = lazy(() => import("@/pages/CookiePolicyPage"));
const WallPage = lazy(() => import("@/pages/WallPage"));
const SitePortalPage = lazy(() => import("@/pages/SitePortalPage"));
const TVDashboardPage = lazy(() => import("@/pages/TVDashboardPage"));
const OperationalReportsPage = lazy(
  () => import("@/pages/OperationalReportsPage"),
);
const CommunicationsPage = lazy(() => import("@/pages/CommunicationsPage"));
const DetectionsTimelinePage = lazy(
  () => import("@/pages/DetectionsTimelinePage"),
);
const CentralVoicePage = lazy(() => import("@/pages/CentralVoicePage"));
const SupervisorPanelPage = lazy(() => import("@/pages/SupervisorPanelPage"));
const CallLogPage = lazy(() => import("@/pages/CallLogPage"));
const NotFound = lazy(() => import("@/pages/NotFound"));

const queryClient = createQueryClient();

function PageLoader() {
  return (
    <div className="flex h-full min-h-[200px] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
        <span className="text-xs text-muted-foreground">Loading...</span>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
          <span className="text-sm text-muted-foreground">
            Cargando Clave Seguridad...
          </span>
        </div>
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function LandingRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <LandingPage />;
}

function ModuleGuard({
  module,
  children,
}: {
  module: string;
  children: React.ReactNode;
}) {
  const { roles } = useAuth();
  if (!hasModuleAccess(roles, module))
    return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <ErrorBoundary>
      <AppErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<LandingRoute />} />
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <LoginPage />
                </PublicRoute>
              }
            />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route
                path="dashboard"
                element={
                  <ModuleGuard module="dashboard">
                    <DashboardPage />
                  </ModuleGuard>
                }
              />
              <Route
                path="live-view"
                element={
                  <ModuleGuard module="live_view">
                    <LiveViewPage />
                  </ModuleGuard>
                }
              />
              <Route path="reverse" element={<ReverseFleetPage />} />
              <Route path="vision-hub" element={<VisionHubPage />} />
              <Route
                path="floor-plan"
                element={
                  <ModuleGuard module="live_view">
                    <FloorPlanPage />
                  </ModuleGuard>
                }
              />
              <Route
                path="immersive"
                element={
                  <ModuleGuard module="live_view">
                    <Immersive3DPage />
                  </ModuleGuard>
                }
              />
              <Route
                path="biogenetic-search"
                element={
                  <ModuleGuard module="analytics">
                    <BiogeneticSearchPage />
                  </ModuleGuard>
                }
              />
              <Route
                path="predictive-criminology"
                element={
                  <ModuleGuard module="analytics">
                    <PredictiveCriminologyPage />
                  </ModuleGuard>
                }
              />
              <Route
                path="playback"
                element={
                  <ModuleGuard module="playback">
                    <PlaybackPage />
                  </ModuleGuard>
                }
              />
              <Route
                path="events"
                element={
                  <ModuleGuard module="events">
                    <EventsPage />
                  </ModuleGuard>
                }
              />
              <Route
                path="incidents"
                element={
                  <ModuleGuard module="incidents">
                    <IncidentsPage />
                  </ModuleGuard>
                }
              />
              <Route
                path="devices"
                element={
                  <ModuleGuard module="devices">
                    <DevicesPage />
                  </ModuleGuard>
                }
              />
              <Route
                path="sites"
                element={
                  <ModuleGuard module="sites">
                    <SitesPage />
                  </ModuleGuard>
                }
              />
              <Route
                path="domotics"
                element={
                  <ModuleGuard module="domotics">
                    <DomoticsPage />
                  </ModuleGuard>
                }
              />
              <Route
                path="access-control"
                element={
                  <ModuleGuard module="access_control">
                    <AccessControlPage />
                  </ModuleGuard>
                }
              />
              <Route
                path="access-doors"
                element={
                  <ModuleGuard module="access_control">
                    <AccessDoorsPage />
                  </ModuleGuard>
                }
              />
              <Route path="live-streams" element={<LiveStreamsPage />} />
              <Route
                path="reboots"
                element={
                  <ModuleGuard module="reboots">
                    <RebootsPage />
                  </ModuleGuard>
                }
              />
              <Route
                path="intercom"
                element={
                  <ModuleGuard module="intercom">
                    <IntercomPage />
                  </ModuleGuard>
                }
              />
              <Route
                path="database"
                element={
                  <ModuleGuard module="database">
                    <DatabasePage />
                  </ModuleGuard>
                }
              />
              <Route
                path="ai-assistant"
                element={
                  <ModuleGuard module="ai_assistant">
                    <AIAssistantPage />
                  </ModuleGuard>
                }
              />
              <Route
                path="integrations"
                element={
                  <ModuleGuard module="integrations">
                    <IntegrationsPage />
                  </ModuleGuard>
                }
              />
              <Route
                path="reports"
                element={
                  <ModuleGuard module="reports">
                    <ReportsPage />
                  </ModuleGuard>
                }
              />
              <Route
                path="audit"
                element={
                  <ModuleGuard module="audit">
                    <AuditPage />
                  </ModuleGuard>
                }
              />
              <Route
                path="system"
                element={
                  <ModuleGuard module="system">
                    <SystemHealthPage />
                  </ModuleGuard>
                }
              />
              <Route
                path="settings"
                element={
                  <ModuleGuard module="settings">
                    <SettingsPage />
                  </ModuleGuard>
                }
              />
              <Route
                path="admin"
                element={
                  <ModuleGuard module="admin">
                    <AdminPage />
                  </ModuleGuard>
                }
              />
              <Route
                path="whatsapp"
                element={
                  <ModuleGuard module="integrations">
                    <WhatsAppPage />
                  </ModuleGuard>
                }
              />
              <Route
                path="alerts"
                element={
                  <ModuleGuard module="alerts">
                    <AlertsPage />
                  </ModuleGuard>
                }
              />
              <Route
                path="notification-templates"
                element={
                  <ModuleGuard module="alerts">
                    <NotificationTemplatesPage />
                  </ModuleGuard>
                }
              />
              <Route
                path="shifts"
                element={
                  <ModuleGuard module="shifts">
                    <ShiftsPage />
                  </ModuleGuard>
                }
              />
              <Route
                path="sla"
                element={
                  <ModuleGuard module="sla">
                    <SLAPage />
                  </ModuleGuard>
                }
              />
              <Route
                path="emergency"
                element={
                  <ModuleGuard module="emergency">
                    <EmergencyPage />
                  </ModuleGuard>
                }
              />
              <Route
                path="patrols"
                element={
                  <ModuleGuard module="patrols">
                    <PatrolsPage />
                  </ModuleGuard>
                }
              />
              <Route
                path="scheduled-reports"
                element={
                  <ModuleGuard module="scheduled_reports">
                    <ScheduledReportsPage />
                  </ModuleGuard>
                }
              />
              <Route
                path="automation"
                element={
                  <ModuleGuard module="automation">
                    <AutomationPage />
                  </ModuleGuard>
                }
              />
              <Route
                path="visitors"
                element={
                  <ModuleGuard module="visitors">
                    <VisitorsPage />
                  </ModuleGuard>
                }
              />
              <Route
                path="analytics"
                element={
                  <ModuleGuard module="analytics">
                    <AnalyticsPage />
                  </ModuleGuard>
                }
              />
              <Route
                path="contracts"
                element={
                  <ModuleGuard module="contracts">
                    <ContractsPage />
                  </ModuleGuard>
                }
              />
              <Route
                path="keys"
                element={
                  <ModuleGuard module="keys">
                    <KeysPage />
                  </ModuleGuard>
                }
              />
              <Route
                path="compliance"
                element={
                  <ModuleGuard module="compliance">
                    <CompliancePage />
                  </ModuleGuard>
                }
              />
              <Route
                path="training"
                element={
                  <ModuleGuard module="training">
                    <TrainingPage />
                  </ModuleGuard>
                }
              />
              <Route
                path="skills"
                element={
                  <ModuleGuard module="ai">
                    <SkillsPage />
                  </ModuleGuard>
                }
              />
              <Route
                path="agent"
                element={
                  <ModuleGuard module="ai">
                    <AgentView />
                  </ModuleGuard>
                }
              />
              <Route
                path="posts"
                element={
                  <ModuleGuard module="posts">
                    <PostsPage />
                  </ModuleGuard>
                }
              />
              <Route
                path="notes"
                element={
                  <ModuleGuard module="notes">
                    <NotesPage />
                  </ModuleGuard>
                }
              />
              <Route
                path="documents"
                element={
                  <ModuleGuard module="documents">
                    <DocumentsPage />
                  </ModuleGuard>
                }
              />
              <Route
                path="minuta"
                element={
                  <ModuleGuard module="minuta">
                    <MinutaPage />
                  </ModuleGuard>
                }
              />
              <Route
                path="phone"
                element={
                  <ModuleGuard module="phone">
                    <PhonePanelPage />
                  </ModuleGuard>
                }
              />
              <Route
                path="communications"
                element={
                  <ModuleGuard module="communications">
                    <CommunicationsPage />
                  </ModuleGuard>
                }
              />
              <Route
                path="network"
                element={
                  <ModuleGuard module="system">
                    <NetworkPage />
                  </ModuleGuard>
                }
              />
              <Route
                path="remote-access"
                element={
                  <ModuleGuard module="system">
                    <RemoteAccessPage />
                  </ModuleGuard>
                }
              />
              <Route
                path="camera-health"
                element={
                  <ModuleGuard module="live_view">
                    <CameraHealthPage />
                  </ModuleGuard>
                }
              />
              <Route
                path="operations"
                element={
                  <ModuleGuard module="operations">
                    <OperationsPanelPage />
                  </ModuleGuard>
                }
              />
              <Route
                path="admin/dashboard"
                element={
                  <ModuleGuard module="admin">
                    <OperationalDashboardPage />
                  </ModuleGuard>
                }
              />
              <Route
                path="admin/residents"
                element={
                  <ModuleGuard module="admin">
                    <ResidentsAdminPage />
                  </ModuleGuard>
                }
              />
              <Route
                path="operational-reports"
                element={
                  <ModuleGuard module="operations">
                    <OperationalReportsPage />
                  </ModuleGuard>
                }
              />
              <Route
                path="detections"
                element={
                  <ModuleGuard module="analytics">
                    <DetectionsTimelinePage />
                  </ModuleGuard>
                }
              />
              <Route
                path="paging"
                element={
                  <ModuleGuard module="domotics">
                    <CentralVoicePage />
                  </ModuleGuard>
                }
              />
              <Route
                path="supervisor"
                element={
                  <ModuleGuard module="admin">
                    <SupervisorPanelPage />
                  </ModuleGuard>
                }
              />
              <Route
                path="call-log"
                element={
                  <ModuleGuard module="intercom">
                    <CallLogPage />
                  </ModuleGuard>
                }
              />
              <Route path="manual" element={<UserManualPage />} />
              <Route path="guard" element={<GuardMobilePage />} />
              <Route path="onboarding" element={<OnboardingWizardPage />} />
            </Route>
            <Route
              path="wall/:screenNumber"
              element={
                <ProtectedRoute>
                  <WallPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="tv"
              element={
                <ProtectedRoute>
                  <TVDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route path="portal/:siteCode" element={<SitePortalPage />} />
            <Route path="privacy" element={<PrivacyPolicyPage />} />
            <Route path="terms" element={<TermsPage />} />
            <Route path="cookies" element={<CookiePolicyPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </AppErrorBoundary>
    </ErrorBoundary>
  );
}

function ThemeWrapper({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  return <div className={theme === "dark" ? "dark" : "light"}>{children}</div>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <I18nProvider>
        <Sonner />
        <Suspense fallback={null}>
          <PWAUpdateNotification />
          <PWAInstallPrompt />
        </Suspense>
        <BrowserRouter>
          <AuthProvider>
            <BrandingProvider>
              <ThemeProvider>
                <ErrorBoundary>
                  <ThemeWrapper>
                    <AppRoutes />
                    <CookieConsentBanner />
                  </ThemeWrapper>
                </ErrorBoundary>
              </ThemeProvider>
            </BrandingProvider>
          </AuthProvider>
        </BrowserRouter>
      </I18nProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
