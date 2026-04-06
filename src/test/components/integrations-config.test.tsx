import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "../test-utils";
import userEvent from "@testing-library/user-event";

const mockIntegrations = [
  {
    id: "int-1",
    name: "WhatsApp Cloud",
    type: "webhook",
    status: "active",
    last_sync: "2025-12-01T10:00:00Z",
    error_message: null,
  },
  {
    id: "int-2",
    name: "OpenAI GPT-4",
    type: "ai_provider",
    status: "active",
    last_sync: "2025-12-01T09:30:00Z",
    error_message: null,
  },
  {
    id: "int-3",
    name: "SMTP Relay",
    type: "email",
    status: "error",
    last_sync: null,
    error_message: "Connection refused on port 587",
  },
];

const mockConnectors = [
  {
    id: "mcp-1",
    name: "Jira Connector",
    type: "jira",
    status: "connected",
    scopes: ["read:issue", "write:issue"],
    error_count: 0,
    health: "healthy",
    last_check: "2025-12-01T10:00:00Z",
  },
  {
    id: "mcp-2",
    name: "Slack Connector",
    type: "slack",
    status: "disconnected",
    scopes: ["chat:write"],
    error_count: 3,
    health: "degraded",
    last_check: null,
  },
];

vi.mock("@/hooks/use-api-data", () => ({
  useIntegrations: () => ({ data: mockIntegrations, isLoading: false }),
  useMcpConnectors: () => ({ data: mockConnectors, isLoading: false }),
}));

vi.mock("@/lib/api-client", () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue([]),
    edgeFunction: vi.fn().mockResolvedValue({ message: "OK", latency_ms: 50 }),
  },
}));

vi.mock("@/services/mcp-registry", () => ({
  MCP_CONNECTOR_CATALOG: [
    {
      type: "jira",
      name: "Jira",
      description: "Issue tracking",
      category: "productivity",
      icon: "Ticket",
      availableTools: [{ name: "create_issue" }, { name: "list_issues" }],
    },
    {
      type: "github",
      name: "GitHub",
      description: "Code management",
      category: "development",
      icon: "Cloud",
      availableTools: [{ name: "create_pr" }],
    },
  ],
}));

vi.mock("@/contexts/I18nContext", () => ({
  useI18n: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "integrations.title": "Integrations",
        "integrations.subtitle": "Manage connectors and webhooks",
        "integrations.active": "Active",
        "integrations.mcp_connectors": "MCP Connectors",
        "integrations.catalog": "Catalog",
        "integrations.no_integrations": "No integrations",
        "integrations.no_connectors": "No connectors",
        "integrations.last_sync": "Last sync",
        "integrations.never": "Never",
        "integrations.errors": "Errors",
        "integrations.health": "Health",
        "integrations.health_check": "Health Check",
        "common.test": "Test",
        "common.disable": "Disable",
        "common.enable": "Enable",
        "common.connect": "Connect",
        "common.disconnect": "Disconnect",
        "common.active": "Active",
        "common.inactive": "Inactive",
      };
      return map[key] || key;
    },
  }),
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

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    roles: ["tenant_admin"],
    profile: { tenant_id: "t1" },
  }),
}));

import IntegrationsPage from "@/pages/IntegrationsPage";

describe("IntegrationsPage — Configuration Flow", () => {
  const user = userEvent.setup();

  it("renders page title and subtitle", () => {
    render(<IntegrationsPage />);
    expect(screen.getByText("Integrations")).toBeInTheDocument();
    expect(
      screen.getByText("Manage connectors and webhooks")
    ).toBeInTheDocument();
  });

  it("renders all three tabs with counts", () => {
    render(<IntegrationsPage />);
    expect(screen.getByText(/Active \(3\)/)).toBeInTheDocument();
    expect(screen.getByText(/MCP Connectors \(2\)/)).toBeInTheDocument();
    expect(screen.getByText(/Catalog \(2\)/)).toBeInTheDocument();
  });

  it("shows active integrations on first tab", () => {
    render(<IntegrationsPage />);
    expect(screen.getByText("WhatsApp Cloud")).toBeInTheDocument();
    expect(screen.getByText("OpenAI GPT-4")).toBeInTheDocument();
    expect(screen.getByText("SMTP Relay")).toBeInTheDocument();
  });

  it("shows integration types", () => {
    render(<IntegrationsPage />);
    expect(screen.getByText("webhook")).toBeInTheDocument();
    expect(screen.getByText("ai provider")).toBeInTheDocument();
    expect(screen.getByText("email")).toBeInTheDocument();
  });

  it("shows error message for failed integrations", () => {
    render(<IntegrationsPage />);
    expect(
      screen.getByText("Connection refused on port 587")
    ).toBeInTheDocument();
  });

  it("shows test and toggle buttons for each integration", () => {
    render(<IntegrationsPage />);
    const testButtons = screen.getAllByText("Test");
    const toggleButtons = screen.getAllByText("Disable");
    expect(testButtons.length).toBe(3);
    // 2 active integrations show "Disable", 1 error shows "Disable" too
    expect(toggleButtons.length).toBeGreaterThanOrEqual(2);
  });

  it("switches to MCP connectors tab", async () => {
    render(<IntegrationsPage />);

    await user.click(screen.getByText(/MCP Connectors/));

    await waitFor(() => {
      expect(screen.getByText("Jira Connector")).toBeInTheDocument();
      expect(screen.getByText("Slack Connector")).toBeInTheDocument();
    });
  });

  it("shows connector scopes as badges", async () => {
    render(<IntegrationsPage />);

    await user.click(screen.getByText(/MCP Connectors/));

    await waitFor(() => {
      expect(screen.getByText("read:issue")).toBeInTheDocument();
      expect(screen.getByText("write:issue")).toBeInTheDocument();
      expect(screen.getByText("chat:write")).toBeInTheDocument();
    });
  });

  it("shows connector health and error counts", async () => {
    render(<IntegrationsPage />);

    await user.click(screen.getByText(/MCP Connectors/));

    await waitFor(() => {
      expect(screen.getByText(/Errors: 0/)).toBeInTheDocument();
      expect(screen.getByText(/Errors: 3/)).toBeInTheDocument();
    });
  });

  it("switches to catalog tab and shows available connectors", async () => {
    render(<IntegrationsPage />);

    await user.click(screen.getByText(/Catalog/));

    await waitFor(() => {
      expect(screen.getByText("Jira")).toBeInTheDocument();
      expect(screen.getByText("Issue tracking")).toBeInTheDocument();
      expect(screen.getByText("GitHub")).toBeInTheDocument();
      expect(screen.getByText("Code management")).toBeInTheDocument();
    });
  });

  it("shows available tools in catalog entries", async () => {
    render(<IntegrationsPage />);

    await user.click(screen.getByText(/Catalog/));

    await waitFor(() => {
      expect(screen.getByText("create_issue")).toBeInTheDocument();
      expect(screen.getByText("list_issues")).toBeInTheDocument();
      expect(screen.getByText("create_pr")).toBeInTheDocument();
    });
  });
});
