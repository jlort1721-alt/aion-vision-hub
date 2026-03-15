import React from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";

// Create a fresh QueryClient for each test to avoid shared state
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

interface WrapperProps {
  children: React.ReactNode;
}

function AllProviders({ children }: WrapperProps) {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>{children}</BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function customRender(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, "wrapper">
) {
  return render(ui, { wrapper: AllProviders, ...options });
}

// Re-export testing library utilities
export * from "@testing-library/react";
export { customRender as render };

// Mock auth context helpers
export function createMockAuthContext(overrides: Partial<{
  isAuthenticated: boolean;
  isLoading: boolean;
  roles: string[];
  user: { id: string; email: string } | null;
  profile: { id: string; tenant_id: string; full_name: string } | null;
}> = {}) {
  return {
    isAuthenticated: true,
    isLoading: false,
    roles: ["operator"],
    user: { id: "test-user-id", email: "test@aion.dev" },
    profile: { id: "test-profile-id", tenant_id: "test-tenant-id", full_name: "Test User", avatar_url: null, is_active: true, user_id: "test-user-id" },
    session: null,
    login: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn(),
    resetPassword: vi.fn(),
    updatePassword: vi.fn(),
    hasRole: (role: string) => (overrides.roles ?? ["operator"]).includes(role),
    hasAnyRole: (roles: string[]) => roles.some((r) => (overrides.roles ?? ["operator"]).includes(r)),
    ...overrides,
  };
}
