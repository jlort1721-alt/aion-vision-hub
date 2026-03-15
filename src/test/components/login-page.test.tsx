import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";

const mockLogin = vi.fn();
const mockSignup = vi.fn();
const mockResetPassword = vi.fn();
const mockNavigate = vi.fn();

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    login: mockLogin,
    signup: mockSignup,
    resetPassword: mockResetPassword,
    isAuthenticated: false,
    isLoading: false,
  }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/integrations/lovable/index", () => ({
  lovable: {
    auth: {
      signInWithOAuth: vi.fn().mockResolvedValue({ error: null }),
    },
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

import LoginPage from "@/pages/LoginPage";

function renderLoginPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogin.mockResolvedValue(undefined);
    mockSignup.mockResolvedValue(undefined);
    mockResetPassword.mockResolvedValue(undefined);
  });

  it("renders login form by default", () => {
    renderLoginPage();
    expect(screen.getByText("AION Vision Hub")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Sign In" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Sign Up" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("submits login form with credentials", async () => {
    renderLoginPage();

    await userEvent.type(screen.getByLabelText("Email"), "admin@aion.dev");
    await userEvent.type(screen.getByLabelText("Password"), "password123");

    const signInButton = screen.getByRole("button", { name: /sign in/i });
    await userEvent.click(signInButton);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith("admin@aion.dev", "password123");
    });
  });

  it("navigates to dashboard after successful login", async () => {
    renderLoginPage();

    await userEvent.type(screen.getByLabelText("Email"), "admin@aion.dev");
    await userEvent.type(screen.getByLabelText("Password"), "pass123");

    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("shows signup form when tab is clicked", async () => {
    renderLoginPage();

    await userEvent.click(screen.getByText("Sign Up"));

    expect(screen.getByLabelText("Full Name")).toBeInTheDocument();
  });

  it("toggles password visibility", async () => {
    renderLoginPage();

    const passwordInput = screen.getByLabelText("Password");
    expect(passwordInput).toHaveAttribute("type", "password");

    // Click the toggle button (the eye icon button)
    const toggleButtons = screen.getAllByRole("button");
    const eyeToggle = toggleButtons.find(
      (btn) => btn.querySelector("svg") && btn.closest(".relative")
    );
    if (eyeToggle) {
      await userEvent.click(eyeToggle);
      expect(passwordInput).toHaveAttribute("type", "text");
    }
  });

  it("shows password reset form", async () => {
    renderLoginPage();

    await userEvent.click(screen.getByText("Forgot password?"));

    expect(
      screen.getByText("Enter your email to receive a password reset link.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /send reset link/i })
    ).toBeInTheDocument();
  });

  it("handles login error gracefully", async () => {
    mockLogin.mockRejectedValue(new Error("Invalid credentials"));
    renderLoginPage();

    await userEvent.type(screen.getByLabelText("Email"), "bad@test.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrong");

    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalled();
    });
    // Button should be re-enabled after error
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /sign in/i })
      ).not.toBeDisabled();
    });
  });

  it("validates password length on signup", async () => {
    renderLoginPage();
    await userEvent.click(screen.getByText("Sign Up"));

    await userEvent.type(screen.getByLabelText("Full Name"), "Test User");
    await userEvent.type(screen.getByLabelText("Email"), "test@test.com");
    await userEvent.type(screen.getByLabelText("Password"), "12345"); // Too short

    await userEvent.click(
      screen.getByRole("button", { name: /create account/i })
    );

    // signup should NOT be called with short password
    expect(mockSignup).not.toHaveBeenCalled();
  });

  it("shows Google sign in option", () => {
    renderLoginPage();
    expect(
      screen.getByRole("button", { name: /continue with google/i })
    ).toBeInTheDocument();
  });

  it("shows back to login from reset form", async () => {
    renderLoginPage();
    await userEvent.click(screen.getByText("Forgot password?"));

    const backBtn = screen.getByRole("button", { name: /back to login/i });
    expect(backBtn).toBeInTheDocument();
  });
});
