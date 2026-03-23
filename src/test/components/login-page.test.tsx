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
    expect(screen.getByText("Clave Seguridad")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Iniciar Sesión" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Registrarse" })).toBeInTheDocument();
    expect(screen.getByLabelText("Correo Electrónico")).toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña")).toBeInTheDocument();
  });

  it("submits login form with credentials", async () => {
    renderLoginPage();

    await userEvent.type(screen.getByLabelText("Correo Electrónico"), "admin@clave.dev");
    await userEvent.type(screen.getByLabelText("Contraseña"), "password123");

    const signInButton = screen.getByRole("button", { name: /iniciar sesión/i });
    await userEvent.click(signInButton);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith("admin@clave.dev", "password123");
    });
  });

  it("navigates to dashboard after successful login", async () => {
    renderLoginPage();

    await userEvent.type(screen.getByLabelText("Correo Electrónico"), "admin@clave.dev");
    await userEvent.type(screen.getByLabelText("Contraseña"), "pass123");

    await userEvent.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("shows signup form when tab is clicked", async () => {
    renderLoginPage();

    await userEvent.click(screen.getByText("Registrarse"));

    expect(screen.getByLabelText("Nombre Completo")).toBeInTheDocument();
  });

  it("toggles password visibility", async () => {
    renderLoginPage();

    const passwordInput = screen.getByLabelText("Contraseña");
    expect(passwordInput).toHaveAttribute("type", "password");

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

    await userEvent.click(screen.getByText("¿Olvidaste tu contraseña?"));

    expect(
      screen.getByText("Ingresa tu correo para recibir un enlace de recuperación de contraseña.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /enviar enlace/i })
    ).toBeInTheDocument();
  });

  it("handles login error gracefully", async () => {
    mockLogin.mockRejectedValue(new Error("Invalid credentials"));
    renderLoginPage();

    await userEvent.type(screen.getByLabelText("Correo Electrónico"), "bad@test.com");
    await userEvent.type(screen.getByLabelText("Contraseña"), "wrong");

    await userEvent.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /iniciar sesión/i })
      ).not.toBeDisabled();
    });
  });

  it("validates password length on signup", async () => {
    renderLoginPage();
    await userEvent.click(screen.getByText("Registrarse"));

    await userEvent.type(screen.getByLabelText("Nombre Completo"), "Test User");
    await userEvent.type(screen.getByLabelText("Correo Electrónico"), "test@test.com");
    await userEvent.type(screen.getByLabelText("Contraseña"), "12345");

    await userEvent.click(
      screen.getByRole("button", { name: /crear cuenta/i })
    );

    expect(mockSignup).not.toHaveBeenCalled();
  });

  it("shows Google sign in option", () => {
    renderLoginPage();
    expect(
      screen.getByRole("button", { name: /continuar con google/i })
    ).toBeInTheDocument();
  });

  it("shows back to login from reset form", async () => {
    renderLoginPage();
    await userEvent.click(screen.getByText("¿Olvidaste tu contraseña?"));

    const backBtn = screen.getByRole("button", { name: /volver al inicio/i });
    expect(backBtn).toBeInTheDocument();
  });
});
