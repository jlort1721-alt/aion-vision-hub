import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "../test-utils";

vi.mock("@/components/whatsapp/WhatsAppConfig", () => ({
  default: () => <div data-testid="whatsapp-config">WhatsApp Config Panel</div>,
}));
vi.mock("@/components/whatsapp/WhatsAppConversations", () => ({
  default: () => (
    <div data-testid="whatsapp-conversations">Conversations Panel</div>
  ),
}));
vi.mock("@/components/whatsapp/WhatsAppTemplates", () => ({
  default: () => (
    <div data-testid="whatsapp-templates">Templates Panel</div>
  ),
}));

import WhatsAppPage from "@/pages/WhatsAppPage";

describe("WhatsAppPage", () => {
  it("renders page heading and description", () => {
    render(<WhatsAppPage />);
    expect(screen.getByText("WhatsApp Business")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Manage WhatsApp conversations, AI agent, and configuration"
      )
    ).toBeInTheDocument();
  });

  it("renders all three tab triggers", () => {
    render(<WhatsAppPage />);
    expect(screen.getByRole("tab", { name: /conversations/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /templates/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /configuration/i })).toBeInTheDocument();
  });

  it("shows conversations tab by default", async () => {
    render(<WhatsAppPage />);
    // Conversations is the default tab
    const conversationsTab = screen.getByRole("tab", { name: /conversations/i });
    expect(conversationsTab).toHaveAttribute("data-state", "active");
  });

  it("lazy loads conversations panel content", async () => {
    render(<WhatsAppPage />);
    // Wait for lazy component to load
    const panel = await screen.findByTestId("whatsapp-conversations");
    expect(panel).toBeInTheDocument();
  });

  it("switches to templates tab", async () => {
    const user = (await import("@testing-library/user-event")).default;
    render(<WhatsAppPage />);

    await user.setup().click(screen.getByRole("tab", { name: /templates/i }));

    const panel = await screen.findByTestId("whatsapp-templates");
    expect(panel).toBeInTheDocument();
  });

  it("switches to configuration tab", async () => {
    const user = (await import("@testing-library/user-event")).default;
    render(<WhatsAppPage />);

    await user.setup().click(screen.getByRole("tab", { name: /configuration/i }));

    const panel = await screen.findByTestId("whatsapp-config");
    expect(panel).toBeInTheDocument();
  });
});
