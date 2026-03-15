import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@/test/test-utils";
import LoginPage from "@/pages/LoginPage";

// Mock supabase client
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signUp: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  },
}));

// Mock useAuth with controllable login/signup/resetPassword
const mockLogin = vi.fn();
const mockSignup = vi.fn();
const mockResetPassword = vi.fn();

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    login: mockLogin,
    signup: mockSignup,
    resetPassword: mockResetPassword,
    user: null,
    session: null,
    profile: null,
    roles: [],
    isAuthenticated: false,
    isLoading: false,
    logout: vi.fn(),
    updatePassword: vi.fn(),
    hasRole: () => false,
    hasAnyRole: () => false,
  }),
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock useToast
const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders login form with email and password fields", () => {
    render(<LoginPage />);

    expect(screen.getByRole("tab", { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /sign up/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it("renders the AION Vision Hub branding", () => {
    render(<LoginPage />);

    expect(screen.getByText("AION Vision Hub")).toBeInTheDocument();
    expect(screen.getByText("Unified Video Surveillance Platform")).toBeInTheDocument();
  });

  it("has a submit button for sign in", () => {
    render(<LoginPage />);

    const signInButton = screen.getByRole("button", { name: /sign in/i });
    expect(signInButton).toBeInTheDocument();
    expect(signInButton).toHaveAttribute("type", "submit");
  });

  it("shows validation when submitting empty login form (HTML required)", () => {
    render(<LoginPage />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);

    expect(emailInput).toBeRequired();
    expect(passwordInput).toBeRequired();
  });

  it("calls login with email and password on form submission", async () => {
    mockLogin.mockResolvedValue(undefined);
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "user@test.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "password123" } });

    const form = screen.getByRole("button", { name: /sign in/i }).closest("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith("user@test.com", "password123");
    });
  });

  it("navigates to dashboard on successful login", async () => {
    mockLogin.mockResolvedValue(undefined);
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "user@test.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "secret" } });

    const form = screen.getByRole("button", { name: /sign in/i }).closest("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("shows error toast on failed login", async () => {
    mockLogin.mockRejectedValue(new Error("Invalid credentials"));
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "user@test.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "wrong" } });

    const form = screen.getByRole("button", { name: /sign in/i }).closest("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Login failed",
          variant: "destructive",
        })
      );
    });
  });

  it("has a sign up tab visible", () => {
    render(<LoginPage />);

    const signUpTab = screen.getByRole("tab", { name: /sign up/i });
    expect(signUpTab).toBeInTheDocument();
  });
});
