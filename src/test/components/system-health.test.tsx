import { describe, it, expect, vi } from "vitest";
import { render, screen } from "../test-utils";
import userEvent from "@testing-library/user-event";

const { mockHealthData, mockQueryClient } = vi.hoisted(() => ({
  mockHealthData: {
    status: "healthy",
    timestamp: "2025-12-01T10:00:00Z",
    checks: [
      {
        component: "PostgreSQL",
        status: "healthy",
        latency_ms: 12,
        details: { connections: "5/100" },
      },
      {
        component: "Redis",
        status: "healthy",
        latency_ms: 3,
        details: { memory: "45MB" },
      },
      {
        component: "MediaMTX",
        status: "degraded",
        latency_ms: 350,
        details: { streams: "12/50" },
      },
      {
        component: "eWeLink API",
        status: "down",
        latency_ms: undefined,
        details: { error: "timeout" },
      },
    ],
  },
  mockQueryClient: {
    invalidateQueries: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: vi.fn().mockReturnValue({
      data: mockHealthData,
      isLoading: false,
      error: null,
    }),
    useQueryClient: () => mockQueryClient,
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
        "system.last_check": "Last check",
        "system.healthy": "Healthy",
        "system.degraded": "Degraded",
        "system.down": "Down",
        "system.latency": "Latency",
        "system.fetch_error": "Fetch error",
        "common.refresh": "Refresh",
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

import SystemHealthPage from "@/pages/SystemHealthPage";

describe("SystemHealthPage — Health Dashboard", () => {
  it("renders page title", () => {
    render(<SystemHealthPage />);
    expect(screen.getByText("System Health")).toBeInTheDocument();
  });

  it("renders summary cards with correct counts", () => {
    render(<SystemHealthPage />);
    expect(screen.getByText("Healthy")).toBeInTheDocument();
    expect(screen.getByText("Degraded")).toBeInTheDocument();
    expect(screen.getByText("Down")).toBeInTheDocument();
  });

  it("renders all health check components", () => {
    render(<SystemHealthPage />);
    expect(screen.getByText("PostgreSQL")).toBeInTheDocument();
    expect(screen.getByText("Redis")).toBeInTheDocument();
    expect(screen.getByText("MediaMTX")).toBeInTheDocument();
    expect(screen.getByText("eWeLink API")).toBeInTheDocument();
  });

  it("shows latency for components that report it", () => {
    render(<SystemHealthPage />);
    expect(screen.getByText("12ms")).toBeInTheDocument();
    expect(screen.getByText("3ms")).toBeInTheDocument();
    expect(screen.getByText("350ms")).toBeInTheDocument();
  });

  it("shows component details", () => {
    render(<SystemHealthPage />);
    expect(screen.getByText(/connections: 5\/100/)).toBeInTheDocument();
    expect(screen.getByText(/memory: 45MB/)).toBeInTheDocument();
    expect(screen.getByText(/streams: 12\/50/)).toBeInTheDocument();
  });

  it("shows status badges for each component", () => {
    render(<SystemHealthPage />);
    const healthyBadges = screen.getAllByText("healthy");
    const degradedBadges = screen.getAllByText("degraded");
    const downBadges = screen.getAllByText("down");

    expect(healthyBadges.length).toBeGreaterThanOrEqual(2);
    expect(degradedBadges.length).toBeGreaterThanOrEqual(1);
    expect(downBadges.length).toBeGreaterThanOrEqual(1);
  });

  it("renders refresh button", () => {
    render(<SystemHealthPage />);
    expect(
      screen.getByRole("button", { name: /refresh/i })
    ).toBeInTheDocument();
  });

  it("calls invalidateQueries on refresh", async () => {
    const user = userEvent.setup();
    render(<SystemHealthPage />);

    await user.click(screen.getByRole("button", { name: /refresh/i }));

    expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["system-health"],
    });
  });

  it("shows last check timestamp", () => {
    render(<SystemHealthPage />);
    expect(screen.getByText(/Last check/)).toBeInTheDocument();
  });
});
