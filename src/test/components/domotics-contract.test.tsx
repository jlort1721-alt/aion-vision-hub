import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "../test-utils";
import userEvent from "@testing-library/user-event";

// Mock all heavy dependencies
const mockDevices = [
  {
    id: "dev-1",
    name: "Puerta Principal",
    type: "door",
    status: "online",
    state: "off",
    section_id: "sec-1",
    brand: "Sonoff",
    model: "BASIC R3",
    last_action: "toggle",
    last_sync: "2025-12-01T10:00:00Z",
    config: { ewelink_id: "ewl-123" },
  },
  {
    id: "dev-2",
    name: "Luz Estacionamiento",
    type: "light",
    status: "online",
    state: "on",
    section_id: "sec-2",
    brand: "Sonoff",
    model: "MINI",
    last_action: null,
    last_sync: null,
    config: {},
  },
  {
    id: "dev-3",
    name: "Sirena Alarma",
    type: "siren",
    status: "offline",
    state: "off",
    section_id: "sec-1",
    brand: "Sonoff",
    model: "DW2",
    last_action: null,
    last_sync: null,
    config: {},
  },
];

const mockSections = [
  { id: "sec-1", name: "Lobby" },
  { id: "sec-2", name: "Parking" },
];

const mockMutations = {
  create: { mutate: vi.fn(), isPending: false },
  toggleState: { mutate: vi.fn(), isPending: false },
  remove: { mutate: vi.fn(), isPending: false },
};

vi.mock("@/hooks/use-module-data", () => ({
  useSections: () => ({ data: mockSections, isLoading: false }),
  useDomoticDevices: () => ({
    data: mockDevices,
    isLoading: false,
    refetch: vi.fn(),
  }),
  useDomoticMutations: () => mockMutations,
  useDomoticActions: () => ({ data: [], isLoading: false }),
}));

vi.mock("@/hooks/use-ewelink", () => ({
  useEWeLinkAuth: () => ({
    isConfigured: true,
    isAuthenticated: false,
    isLoggingIn: false,
    region: "us",
    login: vi.fn(),
    logout: vi.fn(),
  }),
  useEWeLinkControl: () => ({ mutate: vi.fn(), isPending: false }),
  useEWeLinkSync: () => ({ mutate: vi.fn(), isPending: false }),
  useEWeLinkHealth: () => ({ data: null }),
  useEWeLinkLogs: () => ({ data: [] }),
}));

vi.mock("@/contexts/I18nContext", () => ({
  useI18n: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "domotics.title": "Domotics",
        "domotics.subtitle": "Smart home control",
        "domotics.add_device": "Add Device",
        "domotics.search": "Search devices...",
        "domotics.all_sections": "All Sections",
        "domotics.all_types": "All Types",
        "domotics.errors": "Errors",
        "domotics.active": "Active",
        "domotics.devices_count": "devices",
        "domotics.toggle": "Toggle",
        "domotics.test_connection": "Test Connection",
        "domotics.no_devices": "No devices",
        "domotics.no_match": "No match",
        "domotics.section": "Section",
        "domotics.brand_model": "Brand/Model",
        "domotics.state": "State",
        "domotics.quick_actions": "Quick Actions",
        "domotics.power_state": "Power",
        "domotics.activate": "Activate",
        "domotics.deactivate": "Deactivate",
        "domotics.device_info": "Device Info",
        "domotics.last_action": "Last Action",
        "domotics.last_sync": "Last Sync",
        "domotics.action_history": "Action History",
        "common.all": "All",
        "common.online": "Online",
        "common.name": "Name",
        "common.type": "Type",
        "common.status": "Status",
        "common.refresh": "Refresh",
        "common.delete": "Delete",
        "common.edit": "Edit",
        "common.save": "Save",
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
    roles: ["operator"],
    profile: { tenant_id: "t1" },
  }),
}));

import DomoticsPage from "@/pages/DomoticsPage";

describe("DomoticsPage — UI/Backend Contract", () => {
  const user = userEvent.setup();

  it("renders page title and subtitle", () => {
    render(<DomoticsPage />);
    expect(screen.getByText("Domotics")).toBeInTheDocument();
    expect(screen.getByText("Smart home control")).toBeInTheDocument();
  });

  it("renders device statistics correctly", () => {
    render(<DomoticsPage />);
    // All devices count
    expect(screen.getByText("3")).toBeInTheDocument();
    // Online count (2 online devices)
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders device table with all devices", () => {
    render(<DomoticsPage />);
    expect(screen.getByText("Puerta Principal")).toBeInTheDocument();
    expect(screen.getByText("Luz Estacionamiento")).toBeInTheDocument();
    expect(screen.getByText("Sirena Alarma")).toBeInTheDocument();
  });

  it("renders device status badges correctly", () => {
    render(<DomoticsPage />);
    const onlineBadges = screen.getAllByText("online");
    const offlineBadges = screen.getAllByText("offline");
    expect(onlineBadges.length).toBe(2);
    expect(offlineBadges.length).toBe(1);
  });

  it("renders brand/model information", () => {
    render(<DomoticsPage />);
    expect(screen.getByText("Sonoff BASIC R3")).toBeInTheDocument();
    expect(screen.getByText("Sonoff MINI")).toBeInTheDocument();
  });

  it("shows section names from lookup", () => {
    render(<DomoticsPage />);
    expect(screen.getAllByText("Lobby").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Parking").length).toBeGreaterThanOrEqual(1);
  });

  it("renders Add Device button", () => {
    render(<DomoticsPage />);
    const addBtn = screen.getByText("Add Device");
    expect(addBtn).toBeInTheDocument();
  });

  it("renders eWeLink connection badge when configured", () => {
    render(<DomoticsPage />);
    // eWeLink badge should show (unauthenticated)
    expect(screen.getByText("eWeLink")).toBeInTheDocument();
  });

  it("shows footer with device count", () => {
    render(<DomoticsPage />);
    // DataTable renders "{total} items" in its toolbar
    expect(screen.getByText(/3 items/)).toBeInTheDocument();
  });

  it("filters devices by search term", async () => {
    render(<DomoticsPage />);

    const searchInput = screen.getByPlaceholderText("Search devices...");
    await user.type(searchInput, "Puerta");

    expect(screen.getByText("Puerta Principal")).toBeInTheDocument();
    expect(screen.queryByText("Luz Estacionamiento")).not.toBeInTheDocument();
    expect(screen.queryByText("Sirena Alarma")).not.toBeInTheDocument();
  });

  it("shows detail panel when device is clicked", async () => {
    render(<DomoticsPage />);

    await user.click(screen.getByText("Puerta Principal"));

    // Detail panel should show
    await waitFor(() => {
      expect(screen.getByText("Quick Actions")).toBeInTheDocument();
      expect(screen.getByText("Device Info")).toBeInTheDocument();
    });
  });
});
