import { lazy, Suspense, Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { Sentry } from "@/lib/sentry";
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


// ── Error Boundary ──
interface ErrorBoundaryProps { children: ReactNode; fallback?: ReactNode }
interface ErrorBoundaryState { hasError: boolean; error: Error | null }

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }
  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="text-destructive text-lg font-semibold">Something went wrong</div>
          <p className="text-sm text-muted-foreground max-w-md">
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            className="mt-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
// Route-level code splitting: each page loads on-demand
const PWAUpdateNotification = lazy(() => import("@/components/pwa/PWAUpdateNotification").then(m => ({ default: m.PWAUpdateNotification })));
const PWAInstallPrompt = lazy(() => import("@/components/pwa/PWAInstallPrompt").then(m => ({ default: m.PWAInstallPrompt })));
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const ResetPasswordPage = lazy(() => import("@/pages/ResetPasswordPage"));
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const LiveViewPage = lazy(() => import("@/pages/LiveViewPage"));
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
const RebootsPage = lazy(() => import("@/pages/RebootsPage"));
const IntercomPage = lazy(() => import("@/pages/IntercomPage"));
const DatabasePage = lazy(() => import("@/pages/DatabasePage"));
const WhatsAppPage = lazy(() => import("@/pages/WhatsAppPage"));
const AlertsPage = lazy(() => import("@/pages/AlertsPage"));
const NotificationTemplatesPage = lazy(() => import("@/pages/NotificationTemplatesPage"));
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
const PredictiveCriminologyPage = lazy(() => import("@/pages/PredictiveCriminologyPage"));
const PostsPage = lazy(() => import("@/pages/PostsPage"));
const NotesPage = lazy(() => import("@/pages/NotesPage"));
const DocumentsPage = lazy(() => import("@/pages/DocumentsPage"));
const MinutaPage = lazy(() => import("@/pages/MinutaPage"));
const PhonePanelPage = lazy(() => import("@/pages/PhonePanelPage"));
const NetworkPage = lazy(() => import("@/pages/NetworkPage"));
const OperationsPanelPage = lazy(() => import("@/pages/OperationsPanelPage"));
const GuardMobilePage = lazy(() => import("@/pages/GuardMobilePage"));
const OnboardingWizardPage = lazy(() => import("@/pages/OnboardingWizardPage"));
const OperationalDashboardPage = lazy(() => import("@/pages/OperationalDashboardPage"));
const ResidentsAdminPage = lazy(() => import("@/pages/ResidentsAdminPage"));
const LandingPage = lazy(() => import("@/pages/LandingPage"));
const PrivacyPolicyPage = lazy(() => import("@/pages/PrivacyPolicyPage"));
const TermsPage = lazy(() => import("@/pages/TermsPage"));
const CookiePolicyPage = lazy(() => import("@/pages/CookiePolicyPage"));
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
          <span className="text-sm text-muted-foreground">Cargando Clave Seguridad...</span>
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

function ModuleGuard({ module, children }: { module: string; children: React.ReactNode }) {
  const { roles } = useAuth();
  if (!hasModuleAccess(roles, module)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <ErrorBoundary>
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<LandingRoute />} />
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route path="dashboard" element={<ModuleGuard module="dashboard"><DashboardPage /></ModuleGuard>} />
          <Route path="live-view" element={<ModuleGuard module="live_view"><LiveViewPage /></ModuleGuard>} />
          <Route path="immersive" element={<ModuleGuard module="live_view"><Immersive3DPage /></ModuleGuard>} />
          <Route path="biogenetic-search" element={<ModuleGuard module="analytics"><BiogeneticSearchPage /></ModuleGuard>} />
          <Route path="predictive-criminology" element={<ModuleGuard module="analytics"><PredictiveCriminologyPage /></ModuleGuard>} />
          <Route path="playback" element={<ModuleGuard module="playback"><PlaybackPage /></ModuleGuard>} />
          <Route path="events" element={<ModuleGuard module="events"><EventsPage /></ModuleGuard>} />
          <Route path="incidents" element={<ModuleGuard module="incidents"><IncidentsPage /></ModuleGuard>} />
          <Route path="devices" element={<ModuleGuard module="devices"><DevicesPage /></ModuleGuard>} />
          <Route path="sites" element={<ModuleGuard module="sites"><SitesPage /></ModuleGuard>} />
          <Route path="domotics" element={<ModuleGuard module="domotics"><DomoticsPage /></ModuleGuard>} />
          <Route path="access-control" element={<ModuleGuard module="access_control"><AccessControlPage /></ModuleGuard>} />
          <Route path="reboots" element={<ModuleGuard module="reboots"><RebootsPage /></ModuleGuard>} />
          <Route path="intercom" element={<ModuleGuard module="intercom"><IntercomPage /></ModuleGuard>} />
          <Route path="database" element={<ModuleGuard module="database"><DatabasePage /></ModuleGuard>} />
          <Route path="ai-assistant" element={<ModuleGuard module="ai_assistant"><AIAssistantPage /></ModuleGuard>} />
          <Route path="integrations" element={<ModuleGuard module="integrations"><IntegrationsPage /></ModuleGuard>} />
          <Route path="reports" element={<ModuleGuard module="reports"><ReportsPage /></ModuleGuard>} />
          <Route path="audit" element={<ModuleGuard module="audit"><AuditPage /></ModuleGuard>} />
          <Route path="system" element={<ModuleGuard module="system"><SystemHealthPage /></ModuleGuard>} />
          <Route path="settings" element={<ModuleGuard module="settings"><SettingsPage /></ModuleGuard>} />
          <Route path="admin" element={<ModuleGuard module="admin"><AdminPage /></ModuleGuard>} />
          <Route path="whatsapp" element={<ModuleGuard module="integrations"><WhatsAppPage /></ModuleGuard>} />
          <Route path="alerts" element={<ModuleGuard module="alerts"><AlertsPage /></ModuleGuard>} />
          <Route path="notification-templates" element={<ModuleGuard module="alerts"><NotificationTemplatesPage /></ModuleGuard>} />
          <Route path="shifts" element={<ModuleGuard module="shifts"><ShiftsPage /></ModuleGuard>} />
          <Route path="sla" element={<ModuleGuard module="sla"><SLAPage /></ModuleGuard>} />
          <Route path="emergency" element={<ModuleGuard module="emergency"><EmergencyPage /></ModuleGuard>} />
          <Route path="patrols" element={<ModuleGuard module="patrols"><PatrolsPage /></ModuleGuard>} />
          <Route path="scheduled-reports" element={<ModuleGuard module="scheduled_reports"><ScheduledReportsPage /></ModuleGuard>} />
          <Route path="automation" element={<ModuleGuard module="automation"><AutomationPage /></ModuleGuard>} />
          <Route path="visitors" element={<ModuleGuard module="visitors"><VisitorsPage /></ModuleGuard>} />
          <Route path="analytics" element={<ModuleGuard module="analytics"><AnalyticsPage /></ModuleGuard>} />
          <Route path="contracts" element={<ModuleGuard module="contracts"><ContractsPage /></ModuleGuard>} />
          <Route path="keys" element={<ModuleGuard module="keys"><KeysPage /></ModuleGuard>} />
          <Route path="compliance" element={<ModuleGuard module="compliance"><CompliancePage /></ModuleGuard>} />
          <Route path="training" element={<ModuleGuard module="training"><TrainingPage /></ModuleGuard>} />
          <Route path="posts" element={<ModuleGuard module="posts"><PostsPage /></ModuleGuard>} />
          <Route path="notes" element={<ModuleGuard module="notes"><NotesPage /></ModuleGuard>} />
          <Route path="documents" element={<ModuleGuard module="documents"><DocumentsPage /></ModuleGuard>} />
          <Route path="minuta" element={<ModuleGuard module="minuta"><MinutaPage /></ModuleGuard>} />
          <Route path="phone" element={<ModuleGuard module="phone"><PhonePanelPage /></ModuleGuard>} />
          <Route path="network" element={<ModuleGuard module="system"><NetworkPage /></ModuleGuard>} />
          <Route path="operations" element={<ModuleGuard module="operations"><OperationsPanelPage /></ModuleGuard>} />
          <Route path="admin/dashboard" element={<OperationalDashboardPage />} />
          <Route path="admin/residents" element={<ResidentsAdminPage />} />
          <Route path="guard" element={<GuardMobilePage />} />
          <Route path="onboarding" element={<OnboardingWizardPage />} />
        </Route>
        <Route path="privacy" element={<PrivacyPolicyPage />} />
        <Route path="terms" element={<TermsPage />} />
        <Route path="cookies" element={<CookiePolicyPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
    </ErrorBoundary>
  );
}

function ThemeWrapper({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  return <div className={theme === 'dark' ? 'dark' : 'light'}>{children}</div>;
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
