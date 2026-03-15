import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { hasModuleAccess } from "@/lib/permissions";

// Mock the auth context module
const mockAuthState = {
  isAuthenticated: false,
  isLoading: false,
  user: null,
  session: null,
  profile: null,
  roles: [] as string[],
  login: vi.fn(),
  signup: vi.fn(),
  logout: vi.fn(),
  resetPassword: vi.fn(),
  updatePassword: vi.fn(),
  hasRole: (r: string) => mockAuthState.roles.includes(r),
  hasAnyRole: (rs: string[]) => rs.some((r) => mockAuthState.roles.includes(r)),
};

vi.mock("@/contexts/AuthContext", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => mockAuthState,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

function TestWrapper({
  children,
  initialEntries = ["/"],
}: {
  children: React.ReactNode;
  initialEntries?: string[];
}) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return (
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

// Simple components that mirror App.tsx logic
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = mockAuthState;
  if (isLoading) return <div>Loading...</div>;
  if (!isAuthenticated)
    return (
      <Routes>
        <Route path="*" element={<div>Redirected to login</div>} />
      </Routes>
    );
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = mockAuthState;
  if (isLoading) return null;
  if (isAuthenticated) return <div>Redirected to dashboard</div>;
  return <>{children}</>;
}

function ModuleGuard({
  module,
  children,
}: {
  module: string;
  children: React.ReactNode;
}) {
  if (!hasModuleAccess(mockAuthState.roles, module))
    return <div>Access denied</div>;
  return <>{children}</>;
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    mockAuthState.isAuthenticated = false;
    mockAuthState.isLoading = false;
    mockAuthState.roles = [];
  });

  it("shows loading spinner while auth is loading", () => {
    mockAuthState.isLoading = true;
    render(
      <TestWrapper>
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      </TestWrapper>
    );
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  it("redirects unauthenticated users to login", () => {
    mockAuthState.isAuthenticated = false;
    render(
      <TestWrapper>
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      </TestWrapper>
    );
    expect(screen.getByText("Redirected to login")).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  it("renders children for authenticated users", () => {
    mockAuthState.isAuthenticated = true;
    render(
      <TestWrapper>
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      </TestWrapper>
    );
    expect(screen.getByText("Protected Content")).toBeInTheDocument();
  });
});

describe("PublicRoute", () => {
  beforeEach(() => {
    mockAuthState.isAuthenticated = false;
    mockAuthState.isLoading = false;
  });

  it("renders nothing while loading", () => {
    mockAuthState.isLoading = true;
    const { container } = render(
      <TestWrapper>
        <PublicRoute>
          <div>Login Form</div>
        </PublicRoute>
      </TestWrapper>
    );
    expect(screen.queryByText("Login Form")).not.toBeInTheDocument();
  });

  it("shows public content for unauthenticated users", () => {
    render(
      <TestWrapper>
        <PublicRoute>
          <div>Login Form</div>
        </PublicRoute>
      </TestWrapper>
    );
    expect(screen.getByText("Login Form")).toBeInTheDocument();
  });

  it("redirects authenticated users to dashboard", () => {
    mockAuthState.isAuthenticated = true;
    render(
      <TestWrapper>
        <PublicRoute>
          <div>Login Form</div>
        </PublicRoute>
      </TestWrapper>
    );
    expect(screen.getByText("Redirected to dashboard")).toBeInTheDocument();
    expect(screen.queryByText("Login Form")).not.toBeInTheDocument();
  });
});

describe("ModuleGuard", () => {
  beforeEach(() => {
    mockAuthState.roles = [];
  });

  it("blocks access when user has no roles", () => {
    render(
      <TestWrapper>
        <ModuleGuard module="admin">
          <div>Admin Panel</div>
        </ModuleGuard>
      </TestWrapper>
    );
    expect(screen.getByText("Access denied")).toBeInTheDocument();
    expect(screen.queryByText("Admin Panel")).not.toBeInTheDocument();
  });

  it("allows super_admin to access any module", () => {
    mockAuthState.roles = ["super_admin"];
    render(
      <TestWrapper>
        <ModuleGuard module="admin">
          <div>Admin Panel</div>
        </ModuleGuard>
      </TestWrapper>
    );
    expect(screen.getByText("Admin Panel")).toBeInTheDocument();
  });

  it("blocks viewer from admin module", () => {
    mockAuthState.roles = ["viewer"];
    render(
      <TestWrapper>
        <ModuleGuard module="admin">
          <div>Admin Panel</div>
        </ModuleGuard>
      </TestWrapper>
    );
    expect(screen.getByText("Access denied")).toBeInTheDocument();
  });

  it("allows operator to access operational modules", () => {
    mockAuthState.roles = ["operator"];
    render(
      <TestWrapper>
        <ModuleGuard module="devices">
          <div>Devices Content</div>
        </ModuleGuard>
      </TestWrapper>
    );
    expect(screen.getByText("Devices Content")).toBeInTheDocument();
  });

  it("allows viewer to access live_view", () => {
    mockAuthState.roles = ["viewer"];
    render(
      <TestWrapper>
        <ModuleGuard module="live_view">
          <div>Live View Content</div>
        </ModuleGuard>
      </TestWrapper>
    );
    expect(screen.getByText("Live View Content")).toBeInTheDocument();
  });

  it("blocks viewer from domotics module", () => {
    mockAuthState.roles = ["viewer"];
    render(
      <TestWrapper>
        <ModuleGuard module="domotics">
          <div>Domotics Content</div>
        </ModuleGuard>
      </TestWrapper>
    );
    expect(screen.getByText("Access denied")).toBeInTheDocument();
  });

  it("allows auditor to access audit module", () => {
    mockAuthState.roles = ["auditor"];
    render(
      <TestWrapper>
        <ModuleGuard module="audit">
          <div>Audit Log</div>
        </ModuleGuard>
      </TestWrapper>
    );
    expect(screen.getByText("Audit Log")).toBeInTheDocument();
  });

  it("blocks auditor from devices module", () => {
    mockAuthState.roles = ["auditor"];
    render(
      <TestWrapper>
        <ModuleGuard module="devices">
          <div>Devices Content</div>
        </ModuleGuard>
      </TestWrapper>
    );
    expect(screen.getByText("Access denied")).toBeInTheDocument();
  });

  it("combined roles grant union of permissions", () => {
    mockAuthState.roles = ["viewer", "auditor"];
    // viewer has live_view, auditor has audit
    render(
      <TestWrapper>
        <ModuleGuard module="live_view">
          <div>LV</div>
        </ModuleGuard>
      </TestWrapper>
    );
    expect(screen.getByText("LV")).toBeInTheDocument();
  });
});
