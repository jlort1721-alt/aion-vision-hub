import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "../test-utils";
import userEvent from "@testing-library/user-event";

const mockDevices = [
  {
    id: "ic-1",
    name: "Citófono Portería",
    section_id: "sec-1",
    brand: "Fanvil",
    model: "i18S",
    ip_address: "192.168.1.201",
    sip_uri: "sip:101@pbx",
    status: "online",
  },
  {
    id: "ic-2",
    name: "Citófono Torre B",
    section_id: "sec-2",
    brand: "Akuvox",
    model: "R29C",
    ip_address: "192.168.1.202",
    sip_uri: "sip:102@pbx",
    status: "offline",
  },
];

const mockCalls = [
  {
    id: "call-1",
    created_at: "2025-12-01T10:00:00Z",
    direction: "inbound",
    section_id: "sec-1",
    duration_seconds: 45,
    attended_by: "ai",
    status: "completed",
  },
];

const mockSections = [
  { id: "sec-1", name: "Main Entrance" },
  { id: "sec-2", name: "Tower B" },
];

vi.mock("@/hooks/use-module-data", () => ({
  useSections: () => ({ data: mockSections }),
  useIntercomDevices: () => ({ data: mockDevices, isLoading: false }),
  useIntercomCalls: () => ({ data: mockCalls }),
  useIntercomMutations: () => ({
    create: { mutate: vi.fn(), isPending: false },
  }),
}));

vi.mock("@/services/integrations/elevenlabs", () => ({
  elevenlabs: {
    healthCheck: vi.fn().mockResolvedValue({ status: "healthy", tier: "pro", quotaRemaining: 10000, latencyMs: 150 }),
    getConfig: vi.fn().mockResolvedValue({ provider: "elevenlabs", defaultVoiceId: "voice-1" }),
    listVoices: vi.fn().mockResolvedValue([
      { voiceId: "voice-1", name: "Rachel", gender: "female", language: "es" },
    ]),
    getGreetingTemplates: vi.fn().mockResolvedValue([]),
    testConnection: vi.fn().mockResolvedValue({ success: true, message: "OK", latencyMs: 120 }),
    playTTS: vi.fn().mockResolvedValue(undefined),
    generateGreeting: vi.fn().mockResolvedValue({ audioBlob: new Blob() }),
  },
}));

vi.mock("@/contexts/I18nContext", () => ({
  useI18n: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "intercom.title": "Intercom",
        "intercom.subtitle": "Smart intercom system",
        "intercom.add_device": "Add Device",
        "intercom.human_operator": "Human Operator",
        "intercom.ai_agent": "AI Agent",
        "intercom.mixed_mode": "Mixed Mode",
        "intercom.total_devices": "Total Devices",
        "intercom.calls_today": "Calls Today",
        "intercom.attend_mode": "Attend Mode",
        "intercom.devices": "Devices",
        "intercom.call_history": "Call History",
        "intercom.voice_ai": "Voice AI",
        "intercom.all_sections": "All Sections",
        "intercom.section": "Section",
        "intercom.welcome_messages": "Welcome Messages",
        "intercom.welcome_desc": "Configure greeting messages",
        "common.name": "Name",
        "common.status": "Status",
        "common.online": "Online",
        "common.save": "Save",
      };
      return map[key] || key;
    },
  }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    roles: ["operator"],
    profile: { tenant_id: "t1" },
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

import IntercomPage from "@/pages/IntercomPage";

describe("IntercomPage — Mode Selection & Tabs", () => {
  const user = userEvent.setup();

  it("renders page title and subtitle", () => {
    render(<IntercomPage />);
    expect(screen.getByText("Intercom")).toBeInTheDocument();
    expect(screen.getByText("Smart intercom system")).toBeInTheDocument();
  });

  it("renders device statistics", () => {
    render(<IntercomPage />);
    expect(screen.getByText("Total Devices")).toBeInTheDocument();
    expect(screen.getByText("Calls Today")).toBeInTheDocument();
    expect(screen.getByText("Attend Mode")).toBeInTheDocument();
  });

  it("defaults to mixed attend mode", () => {
    render(<IntercomPage />);
    // The mode card should show "mixed"
    const modeTexts = screen.getAllByText(/mixed/i);
    expect(modeTexts.length).toBeGreaterThanOrEqual(1);
  });

  it("renders all four tabs", () => {
    render(<IntercomPage />);
    expect(screen.getByRole("tab", { name: /devices/i })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /call history/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /whatsapp/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /voice ai/i })).toBeInTheDocument();
  });

  it("shows device list on devices tab", () => {
    render(<IntercomPage />);
    expect(screen.getByText("Citófono Portería")).toBeInTheDocument();
    expect(screen.getByText("Citófono Torre B")).toBeInTheDocument();
  });

  it("shows device IP addresses", () => {
    render(<IntercomPage />);
    expect(screen.getByText("192.168.1.201")).toBeInTheDocument();
    expect(screen.getByText("192.168.1.202")).toBeInTheDocument();
  });

  it("shows device SIP URIs", () => {
    render(<IntercomPage />);
    expect(screen.getByText("sip:101@pbx")).toBeInTheDocument();
    expect(screen.getByText("sip:102@pbx")).toBeInTheDocument();
  });

  it("renders call history tab with records", async () => {
    render(<IntercomPage />);

    await user.click(screen.getByRole("tab", { name: /call history/i }));

    await waitFor(() => {
      expect(screen.getByText("inbound")).toBeInTheDocument();
      expect(screen.getByText("45s")).toBeInTheDocument();
      expect(screen.getByText("completed")).toBeInTheDocument();
    });
  });

  it("renders WhatsApp integration tab", async () => {
    render(<IntercomPage />);

    await user.click(screen.getByRole("tab", { name: /whatsapp/i }));

    await waitFor(() => {
      expect(
        screen.getByText("WhatsApp Business API Integration")
      ).toBeInTheDocument();
    });
  });

  it("renders Voice AI tab with provider status", async () => {
    render(<IntercomPage />);

    await user.click(screen.getByRole("tab", { name: /voice ai/i }));

    await waitFor(() => {
      expect(screen.getByText("Provider")).toBeInTheDocument();
      expect(screen.getByText("Connection Test")).toBeInTheDocument();
      expect(screen.getByText("Mode")).toBeInTheDocument();
    });
  });

  it("shows Add Device button", () => {
    render(<IntercomPage />);
    expect(screen.getByText("Add Device")).toBeInTheDocument();
  });

  it("renders mode description for mixed mode", async () => {
    render(<IntercomPage />);

    await user.click(screen.getByRole("tab", { name: /voice ai/i }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "AION greets, then transfers to operator if needed"
        )
      ).toBeInTheDocument();
    });
  });
});
