import { describe, it, expect, vi } from "vitest";
import { render, screen } from "../test-utils";

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: vi.fn().mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    }),
    useQueryClient: () => ({
      invalidateQueries: vi.fn().mockResolvedValue(undefined),
    }),
  };
});

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    roles: ["super_admin"],
    profile: { tenant_id: "t1" },
  }),
}));

vi.mock("@/contexts/I18nContext", () => ({
  useI18n: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "system.title": "System Health",
        "system.subtitle": "Infrastructure monitoring",
      };
      return map[key] || key;
    },
  }),
}));

vi.mock("@/services/api", () => ({
  healthApi: {
    check: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/services/system-health-api", () => ({
  systemHealthApi: {
    getStatus: vi.fn().mockResolvedValue({ status: "healthy", checks: [] }),
    getReady: vi.fn().mockResolvedValue({ status: "ok" }),
    getDevices: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  },
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: any) => children,
  LineChart: ({ children }: any) => <div>{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}));

import SystemHealthPage from "@/pages/SystemHealthPage";

describe("SystemHealthPage — Health Dashboard", () => {
  it("renders page title", () => {
    render(<SystemHealthPage />);
    expect(screen.getByText("System Health")).toBeInTheDocument();
  });

  it("renders the page without crashing", () => {
    const { container } = render(<SystemHealthPage />);
    expect(container.querySelector(".p-6")).toBeTruthy();
  });

  it("renders auto-refresh toggle", () => {
    render(<SystemHealthPage />);
    const allText = document.body.textContent || "";
    expect(allText).toContain("Auto-refresh");
  });
});
