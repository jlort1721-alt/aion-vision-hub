import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@/test/test-utils";
import DashboardPage from "@/pages/DashboardPage";

// Mock supabase client
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
    }),
    removeChannel: vi.fn(),
  },
}));

// Mock AuthContext
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    user: { id: "test-user-id", email: "test@aion.dev" },
    profile: { id: "p1", tenant_id: "t1", full_name: "Test User", avatar_url: null, is_active: true, user_id: "test-user-id" },
    roles: ["operator"],
    session: null,
    login: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn(),
    resetPassword: vi.fn(),
    updatePassword: vi.fn(),
    hasRole: () => true,
    hasAnyRole: () => true,
  }),
}));

// Mock I18nContext
vi.mock("@/contexts/I18nContext", () => ({
  useI18n: () => ({
    lang: "en",
    setLang: vi.fn(),
    t: (key: string) => {
      const translations: Record<string, string> = {
        "dashboard.title": "Dashboard",
        "dashboard.subtitle": "Real-time overview",
        "dashboard.total_devices": "Total Devices",
        "dashboard.online": "online",
        "dashboard.offline": "offline",
        "dashboard.active_alerts": "Active Alerts",
        "dashboard.critical_high": "critical/high",
        "dashboard.sites": "Sites",
        "dashboard.healthy": "healthy",
        "dashboard.system_health": "System Health",
        "dashboard.components_ok": "components OK",
        "dashboard.events_per_hour": "Events per Hour",
        "dashboard.device_status": "Device Status",
        "dashboard.event_timeline": "Event Timeline",
        "dashboard.active_alerts_by_site": "Active Alerts by Site",
        "dashboard.severity_distribution": "Severity Distribution",
        "dashboard.recent_events": "Recent Events",
        "dashboard.system_health_card": "System Health",
        "dashboard.devices_by_site": "Devices by Site",
        "dashboard.quick_actions": "Quick Actions",
        "dashboard.view_all": "View All",
        "dashboard.details": "Details",
        "dashboard.no_devices": "No devices",
        "dashboard.no_events": "No events",
        "dashboard.no_active_alerts": "No active alerts",
        "dashboard.loading_health": "Loading health...",
        "dashboard.enable_notifications": "Enable Notifications",
        "dashboard.disable_notifications": "Disable Notifications",
        "dashboard.notifications_on": "Notifications On",
        "dashboard.open_live_view": "Open Live View",
        "dashboard.add_device": "Add Device",
        "dashboard.new_incident": "New Incident",
        "dashboard.devices_online": "devices online",
        "nav.live_view": "Live View",
        "nav.ai_assistant": "AI Assistant",
      };
      return translations[key] || key;
    },
  }),
}));

// Mock hooks that fetch data
vi.mock("@/hooks/use-supabase-data", () => ({
  useDevices: () => ({ data: [], isLoading: false }),
  useSites: () => ({ data: [], isLoading: false }),
  useEventsLegacy: () => ({ data: [], isLoading: false }),
}));

vi.mock("@/hooks/use-realtime-events", () => ({
  useRealtimeEvents: vi.fn(),
}));

vi.mock("@/hooks/use-push-notifications", () => ({
  usePushNotifications: () => ({
    permission: "default" as NotificationPermission,
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    isSubscribed: false,
    showNotification: vi.fn(),
  }),
}));

vi.mock("@/lib/api-client", () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue([]),
    edgeFunction: vi.fn().mockResolvedValue({ checks: [] }),
  },
}));

// Mock recharts to avoid SVG rendering issues in jsdom
vi.mock("recharts", () => {
  const MockComponent = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    ResponsiveContainer: MockComponent,
    BarChart: MockComponent,
    Bar: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
    CartesianGrid: () => null,
    PieChart: MockComponent,
    Pie: () => null,
    Cell: () => null,
    AreaChart: MockComponent,
    Area: () => null,
    LineChart: MockComponent,
    Line: () => null,
  };
});

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing", () => {
    render(<DashboardPage />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("shows dashboard title and subtitle", () => {
    render(<DashboardPage />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Real-time overview")).toBeInTheDocument();
  });

  it("displays stats cards section", () => {
    render(<DashboardPage />);
    expect(screen.getByText("Total Devices")).toBeInTheDocument();
    expect(screen.getByText("Active Alerts")).toBeInTheDocument();
    expect(screen.getByText("Sites")).toBeInTheDocument();
    expect(screen.getAllByText("System Health").length).toBeGreaterThanOrEqual(1);
  });

  it("displays chart sections", () => {
    render(<DashboardPage />);
    expect(screen.getByText("Events per Hour")).toBeInTheDocument();
    expect(screen.getByText("Device Status")).toBeInTheDocument();
    expect(screen.getByText("Event Timeline")).toBeInTheDocument();
    expect(screen.getByText("Severity Distribution")).toBeInTheDocument();
  });

  it("displays activity sections", () => {
    render(<DashboardPage />);
    expect(screen.getByText("Recent Events")).toBeInTheDocument();
    expect(screen.getByText("Quick Actions")).toBeInTheDocument();
    expect(screen.getByText("Devices by Site")).toBeInTheDocument();
  });

  it("has an Open Live View button", () => {
    render(<DashboardPage />);
    expect(screen.getByRole("button", { name: /open live view/i })).toBeInTheDocument();
  });

  it("shows quick action buttons", () => {
    render(<DashboardPage />);
    expect(screen.getByText("Live View")).toBeInTheDocument();
    expect(screen.getByText("New Incident")).toBeInTheDocument();
    expect(screen.getByText("AI Assistant")).toBeInTheDocument();
  });
});
