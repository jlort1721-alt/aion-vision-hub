import { vi } from "vitest";

export const MOCK_TENANT = "t0000000-0000-0000-0000-000000000001";
export const MOCK_USER = "u0000000-0000-0000-0000-000000000001";

export function mockContext(
  overrides: Partial<{ tenantId: string; userId: string }> = {},
) {
  return {
    tenantId: overrides.tenantId ?? MOCK_TENANT,
    userId: overrides.userId ?? MOCK_USER,
  };
}

export function mockDbSelect(rows: Record<string, unknown>[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(rows),
        }),
      }),
      orderBy: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
      limit: vi.fn().mockResolvedValue(rows),
    }),
  };
}

export function mockDbInsert() {
  return {
    values: vi.fn().mockResolvedValue([{ id: "new-id" }]),
  };
}

export function mockDbExecute(rows: Record<string, unknown>[] = []) {
  return vi.fn().mockResolvedValue(rows);
}
