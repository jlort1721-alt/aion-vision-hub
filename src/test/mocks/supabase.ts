import { vi } from "vitest";

// Chainable mock builder for Supabase queries
function createChainableMock(data: any[] = [], error: any = null) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: data[0] ?? null, error }),
    maybeSingle: vi.fn().mockResolvedValue({ data: data[0] ?? null, error }),
    then: vi.fn((resolve: any) => resolve({ data, error })),
  };
  // Make the chain itself thenable
  chain[Symbol.for("jest.fn")] = true;
  return chain;
}

export function createMockSupabaseClient(overrides: Record<string, any[]> = {}) {
  return {
    from: vi.fn((table: string) => createChainableMock(overrides[table] || [])),
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: null },
        error: null,
      }),
      signInWithPassword: vi.fn().mockResolvedValue({
        data: { session: { user: { id: "test-user" } } },
        error: null,
      }),
      signUp: vi.fn().mockResolvedValue({
        data: { user: { id: "test-user" } },
        error: null,
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
      updateUser: vi.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: {}, error: null }),
    },
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
    }),
    removeChannel: vi.fn(),
  };
}

// Auto-mock for @/integrations/supabase/client
export const supabase = createMockSupabaseClient();
