import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@/test/test-utils";
import AppLayout from "@/components/layout/AppLayout";

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
    profile: {
      id: "p1",
      tenant_id: "t1",
      full_name: "Test User",
      avatar_url: null,
      is_active: true,
      user_id: "test-user-id",
    },
    roles: ["operator"],
    session: null,
    login: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn(),
    resetPassword: vi.fn(),
    updatePassword: vi.fn(),
    hasRole: (role: string) => role === "operator",
    hasAnyRole: (roles: string[]) => roles.includes("operator"),
  }),
}));

// Mock I18nContext
vi.mock("@/contexts/I18nContext", () => ({
  useI18n: () => ({
    lang: "en",
    setLang: vi.fn(),
    t: (key: string) => {
      const translations: Record<string, string> = {
        "nav.dashboard": "Dashboard",
        "nav.live_view": "Live View",
        "nav.playback": "Playback",
        "nav.events": "Events",
        "nav.incidents": "Incidents",
        "nav.devices": "Devices",
        "nav.sites": "Sites",
        "nav.domotics": "Domotics",
        "nav.access_control": "Access Control",
        "nav.reboots": "Reboots",
        "nav.intercom": "Intercom",
        "nav.database": "Database",
        "nav.ai_assistant": "AI Assistant",
        "nav.whatsapp": "WhatsApp",
        "nav.integrations": "Integrations",
        "nav.reports": "Reports",
        "nav.audit": "Audit",
        "nav.system": "System",
        "nav.settings": "Settings",
        "nav.admin": "Admin",
        "common.profile": "Profile",
        "common.security": "Security",
        "common.sign_out": "Sign Out",
        "search.placeholder": "Search...",
      };
      return translations[key] || key;
    },
  }),
}));

// Mock permissions
vi.mock("@/lib/permissions", () => ({
  hasModuleAccess: () => true,
  ALL_MODULES: [
    { module: "dashboard", path: "/dashboard" },
    { module: "live_view", path: "/live-view" },
    { module: "playback", path: "/playback" },
    { module: "events", path: "/events" },
    { module: "incidents", path: "/incidents" },
    { module: "devices", path: "/devices" },
    { module: "sites", path: "/sites" },
    { module: "domotics", path: "/domotics" },
    { module: "access_control", path: "/access-control" },
    { module: "reboots", path: "/reboots" },
    { module: "intercom", path: "/intercom" },
    { module: "database", path: "/database" },
    { module: "ai_assistant", path: "/ai-assistant" },
    { module: "whatsapp", path: "/whatsapp" },
    { module: "integrations", path: "/integrations" },
    { module: "reports", path: "/reports" },
    { module: "audit", path: "/audit" },
    { module: "system", path: "/system" },
    { module: "settings", path: "/settings" },
    { module: "admin", path: "/admin" },
  ],
  DEFAULT_ROLE_PERMISSIONS: {
    operator: ["dashboard", "live_view", "playback", "events", "incidents", "devices", "sites"],
  },
}));

// Mock CommandPalette lazy-loaded component
vi.mock("@/components/CommandPalette", () => ({
  default: () => <div data-testid="command-palette" />,
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: "/dashboard", search: "", hash: "", state: null, key: "default" }),
    Outlet: () => <div data-testid="router-outlet">Page Content</div>,
  };
});

describe("AppLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the sidebar navigation", () => {
    render(<AppLayout />);
    expect(screen.getByText("AION")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Live View")).toBeInTheDocument();
    expect(screen.getByText("Events")).toBeInTheDocument();
    expect(screen.getByText("Devices")).toBeInTheDocument();
  });

  it("contains all expected navigation links", () => {
    render(<AppLayout />);

    const expectedNavItems = [
      "Dashboard",
      "Live View",
      "Playback",
      "Events",
      "Incidents",
      "Devices",
      "Sites",
      "Reports",
      "Settings",
    ];

    for (const item of expectedNavItems) {
      expect(screen.getByText(item)).toBeInTheDocument();
    }
  });

  it("renders the main content area with Outlet", () => {
    render(<AppLayout />);
    expect(screen.getByTestId("router-outlet")).toBeInTheDocument();
    expect(screen.getByText("Page Content")).toBeInTheDocument();
  });

  it("shows user display name in sidebar", () => {
    render(<AppLayout />);
    expect(screen.getByText("Test User")).toBeInTheDocument();
    expect(screen.getByText("test@aion.dev")).toBeInTheDocument();
  });

  it("shows user initials in avatar", () => {
    render(<AppLayout />);
    expect(screen.getByText("TU")).toBeInTheDocument();
  });
});
