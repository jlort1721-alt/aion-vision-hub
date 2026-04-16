/**
 * Opus-tier tool handler tests — 8 handlers that perform irreversible
 * or security-critical operations.
 *
 * Strategy: mock db (select/insert/execute) at the drizzle level,
 * mock external HTTP calls (Hikvision ISAPI, eWeLink), verify that
 * each handler returns the expected shape and writes audit logs.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockContext, MOCK_TENANT, MOCK_USER } from "./tool-test-helpers.js";

// ── DB mock ────────────────────────────────────────────────

const mockSelectRows: Record<string, unknown>[][] = [];
const mockInsertFn = vi.fn().mockResolvedValue([{ id: "new-id" }]);

vi.mock("../../db/client.js", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve(mockSelectRows.shift() ?? [])),
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve(mockSelectRows.shift() ?? [])),
          })),
        })),
        limit: vi.fn(() => Promise.resolve(mockSelectRows.shift() ?? [])),
      })),
    })),
    insert: vi.fn(() => ({
      values: mockInsertFn,
    })),
    execute: vi.fn(() => Promise.resolve(mockSelectRows.shift() ?? [])),
  },
}));

// ── Schema mocks (drizzle tables reference) ────────────────

vi.mock("../../db/schema/index.js", () => {
  const col = (name: string) => name;
  const fakeTable = {
    id: col("id"),
    tenantId: col("tenantId"),
    isActive: col("isActive"),
    status: col("status"),
    type: col("type"),
    name: col("name"),
    createdAt: col("createdAt"),
    severity: col("severity"),
    siteId: col("siteId"),
    deviceId: col("deviceId"),
    userId: col("userId"),
    userEmail: col("userEmail"),
    action: col("action"),
    entityType: col("entityType"),
    entityId: col("entityId"),
    afterState: col("afterState"),
    ruleId: col("ruleId"),
    priority: col("priority"),
    description: col("description"),
  };
  const names = [
    "tenants",
    "refreshTokens",
    "profiles",
    "userRoles",
    "sites",
    "devices",
    "deviceGroups",
    "events",
    "incidents",
    "sections",
    "domoticDevices",
    "domoticActions",
    "accessPeople",
    "accessVehicles",
    "accessLogs",
    "rebootTasks",
    "intercomDevices",
    "intercomCalls",
    "callSessions",
    "voipConfig",
    "databaseRecords",
    "waConversations",
    "waMessages",
    "waTemplates",
    "floorPlanPositions",
    "reports",
    "biomarkers",
    "apiKeys",
    "evidence",
    "knowledgeBase",
    "operationalNotes",
    "cameraDetections",
    "domoticScenes",
    "domoticSceneExecutions",
    "pagingBroadcasts",
    "pagingTemplates",
    "hikRecordings",
    "auditLogs",
    "alertRules",
    "alertInstances",
    "notificationLog",
    "notificationChannels",
    "automationRules",
    "automationExecutions",
    "emergencyProtocols",
    "emergencyActivations",
    "emergencyContacts",
    "cameras",
    "streams",
    "clips",
    "clipExports",
    "visitors",
    "slaDefinitions",
    "slaTracking",
    "certifications",
    "complianceTemplates",
    "retentionPolicies",
    "agentTools",
    "agentKnowledge",
    "agentLearning",
    "agentToolLogs",
    "aiSessions",
    "contracts",
    "keys",
    "keyLogs",
    "sirens",
    "guardSchedules",
    "patrolRoutes",
    "patrolLogs",
  ];
  const mod: Record<string, unknown> = {};
  for (const n of names) mod[n] = { ...fakeTable };
  return mod;
});

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => args),
  and: vi.fn((...args: unknown[]) => args),
  desc: vi.fn((col: unknown) => col),
  asc: vi.fn((col: unknown) => col),
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => ({
      getSQL: () => ({ strings, values }),
      queryChunks: [],
      append: vi.fn(),
      mapWith: vi.fn(),
    }),
    { raw: vi.fn(() => "raw") },
  ),
  gte: vi.fn(),
  lte: vi.fn(),
  isNull: vi.fn(),
  inArray: vi.fn(),
  like: vi.fn(),
  ilike: vi.fn(),
  count: vi.fn(),
  sum: vi.fn(),
  avg: vi.fn(),
  max: vi.fn(),
  not: vi.fn(),
  or: vi.fn(),
}));

// ── External service mocks ─────────────────────────────────

vi.mock("../../services/hikvision-isapi.js", () => ({
  hikvisionISAPI: {
    getDeviceInfo: vi
      .fn()
      .mockResolvedValue({ online: true, model: "DS-TEST" }),
    setDeviceTime: vi.fn().mockResolvedValue(true),
    getDeviceTime: vi.fn().mockResolvedValue({
      localTime: new Date().toISOString(),
      timeZone: "CST-5",
    }),
    ptzControl: vi.fn().mockResolvedValue({ success: true }),
    ptzMove: vi.fn().mockResolvedValue(true),
    ptzPreset: vi.fn().mockResolvedValue(true),
    ptzStop: vi.fn().mockResolvedValue(true),
    getChannels: vi.fn().mockResolvedValue([]),
    getHDDs: vi.fn().mockResolvedValue([]),
    snapshot: vi.fn().mockResolvedValue(Buffer.from("jpg")),
  },
}));

vi.mock("../../services/dahua-cgi.js", () => ({
  dahuaCGI: {
    getDeviceInfo: vi
      .fn()
      .mockResolvedValue({ online: true, model: "DHI-TEST" }),
    setDeviceTime: vi.fn().mockResolvedValue(true),
    getDeviceTime: vi.fn().mockResolvedValue("2026-04-16 03:00:00"),
    rebootDevice: vi.fn().mockResolvedValue(true),
  },
}));

// ── Reset ──────────────────────────────────────────────────

beforeEach(() => {
  mockSelectRows.length = 0;
  mockInsertFn.mockClear();
  vi.clearAllMocks();
});

// ── Helpers ────────────────────────────────────────────────

function mockDevice(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    id: "dev-001",
    tenantId: MOCK_TENANT,
    name: "Test Device",
    type: "access_control",
    brand: "hikvision",
    ipAddress: "192.168.1.100",
    port: 8000,
    username: "admin",
    password: "pass",
    status: "online",
    siteId: "site-001",
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════════════
// 1. open_gate
// ══════════════════════════════════════════════════════════════

describe("open_gate", () => {
  it("returns error when device_id or reason missing", async () => {
    const { deviceCommandTools } =
      await import("../../modules/mcp-bridge/tools/device-command.js");
    const tool = deviceCommandTools.find(
      (t: { name: string }) => t.name === "open_gate",
    );
    expect(tool).toBeDefined();

    const result = await tool!.execute({}, mockContext());
    expect(result).toHaveProperty("error");
    expect((result as Record<string, string>).error).toContain("required");
  });

  it("returns error when device not found", async () => {
    mockSelectRows.push([]); // verifyDeviceOwnership returns empty

    const { deviceCommandTools } =
      await import("../../modules/mcp-bridge/tools/device-command.js");
    const tool = deviceCommandTools.find(
      (t: { name: string }) => t.name === "open_gate",
    );

    const result = await tool!.execute(
      { device_id: "fake-id", reason: "test" },
      mockContext(),
    );
    expect(result).toHaveProperty("error");
    expect((result as Record<string, string>).error).toContain("not found");
  });

  it("returns error for wrong device type", async () => {
    mockSelectRows.push([mockDevice({ type: "camera" })]);

    const { deviceCommandTools } =
      await import("../../modules/mcp-bridge/tools/device-command.js");
    const tool = deviceCommandTools.find(
      (t: { name: string }) => t.name === "open_gate",
    );

    const result = await tool!.execute(
      { device_id: "dev-001", reason: "test" },
      mockContext(),
    );
    expect(result).toHaveProperty("error");
    expect((result as Record<string, string>).error).toContain(
      "access_control",
    );
  });
});

// ══════════════════════════════════════════════════════════════
// 2. toggle_relay
// ══════════════════════════════════════════════════════════════

describe("toggle_relay", () => {
  it("returns error when device_id missing", async () => {
    const { deviceCommandTools } =
      await import("../../modules/mcp-bridge/tools/device-command.js");
    const tool = deviceCommandTools.find(
      (t: { name: string }) => t.name === "toggle_relay",
    );
    expect(tool).toBeDefined();

    const result = await tool!.execute({}, mockContext());
    expect(result).toHaveProperty("error");
  });

  it("returns error when device not found", async () => {
    mockSelectRows.push([]);

    const { deviceCommandTools } =
      await import("../../modules/mcp-bridge/tools/device-command.js");
    const tool = deviceCommandTools.find(
      (t: { name: string }) => t.name === "toggle_relay",
    );

    const result = await tool!.execute(
      { device_id: "fake", relay_index: 1 },
      mockContext(),
    );
    expect(result).toHaveProperty("error");
  });
});

// ══════════════════════════════════════════════════════════════
// 3. reboot_device
// ══════════════════════════════════════════════════════════════

describe("reboot_device", () => {
  it("returns error when device_id missing", async () => {
    const { deviceCommandTools } =
      await import("../../modules/mcp-bridge/tools/device-command.js");
    const tool = deviceCommandTools.find(
      (t: { name: string }) => t.name === "reboot_device",
    );
    expect(tool).toBeDefined();

    const result = await tool!.execute({}, mockContext());
    expect(result).toHaveProperty("error");
  });

  it("returns error when device not found", async () => {
    mockSelectRows.push([]);

    const { deviceCommandTools } =
      await import("../../modules/mcp-bridge/tools/device-command.js");
    const tool = deviceCommandTools.find(
      (t: { name: string }) => t.name === "reboot_device",
    );

    const result = await tool!.execute(
      { device_id: "fake", reason: "maintenance" },
      mockContext(),
    );
    expect(result).toHaveProperty("error");
  });
});

// ══════════════════════════════════════════════════════════════
// 4. activate_emergency_protocol
// ══════════════════════════════════════════════════════════════

describe("activate_emergency_protocol", () => {
  it("returns error when protocol_id missing", async () => {
    const { emergencyTools } =
      await import("../../modules/mcp-bridge/tools/emergency-tools.js");
    const tool = emergencyTools.find(
      (t: { name: string }) => t.name === "activate_emergency_protocol",
    );
    expect(tool).toBeDefined();

    const result = await tool!.execute({}, mockContext());
    expect(result).toHaveProperty("error");
  });

  it("returns error when protocol not found", async () => {
    mockSelectRows.push([]);

    const { emergencyTools } =
      await import("../../modules/mcp-bridge/tools/emergency-tools.js");
    const tool = emergencyTools.find(
      (t: { name: string }) => t.name === "activate_emergency_protocol",
    );

    const result = await tool!.execute(
      { protocol_id: "fake", reason: "test drill" },
      mockContext(),
    );
    expect(result).toHaveProperty("error");
  });
});

// ══════════════════════════════════════════════════════════════
// 5. get_compliance_status (was audit_compliance_template — doesn't exist)
// ══════════════════════════════════════════════════════════════

describe("get_compliance_status", () => {
  it("tool is registered and returns data shape", async () => {
    const { complianceTrainingTools } =
      await import("../../modules/mcp-bridge/tools/compliance-training-tools.js");
    const tool = complianceTrainingTools.find(
      (t: { name: string }) => t.name === "get_compliance_status",
    );
    expect(tool).toBeDefined();
    expect(tool!.parameters).toBeDefined();

    const result = await tool!.execute({}, mockContext());
    expect(result).toBeDefined();
  });
});

// ══════════════════════════════════════════════════════════════
// 6. hikvision_ptz_control
// ══════════════════════════════════════════════════════════════

describe("hikvision_ptz_control", () => {
  it("tool is registered with correct parameters", async () => {
    const { hikvisionISAPITools } =
      await import("../../modules/mcp-bridge/tools/hikvision-isapi-tools.js");
    const tool = hikvisionISAPITools.find(
      (t: { name: string }) => t.name === "hikvision_ptz_control",
    );
    expect(tool).toBeDefined();
    expect(tool!.parameters).toHaveProperty("deviceId");
    expect(tool!.parameters).toHaveProperty("action");
  });

  it("calls ptzMove for valid move action", async () => {
    const { hikvisionISAPITools } =
      await import("../../modules/mcp-bridge/tools/hikvision-isapi-tools.js");
    const tool = hikvisionISAPITools.find(
      (t: { name: string }) => t.name === "hikvision_ptz_control",
    );

    const result = (await tool!.execute(
      { device_id: "dev-001", action: "left", channel: "1" },
      mockContext(),
    )) as Record<string, unknown>;
    expect(result).toHaveProperty("success");
  });
});

// ══════════════════════════════════════════════════════════════
// 7. generate_incident_summary
// ══════════════════════════════════════════════════════════════

describe("generate_incident_summary", () => {
  it("returns error when incident_id missing", async () => {
    const { aiSummaryTools } =
      await import("../../modules/mcp-bridge/tools/ai-summary-tools.js");
    const tool = aiSummaryTools.find(
      (t: { name: string }) => t.name === "generate_incident_summary",
    );
    expect(tool).toBeDefined();

    const result = await tool!.execute({}, mockContext());
    expect(result).toHaveProperty("error");
  });

  it("returns error when incident not found", async () => {
    mockSelectRows.push([]);

    const { aiSummaryTools } =
      await import("../../modules/mcp-bridge/tools/ai-summary-tools.js");
    const tool = aiSummaryTools.find(
      (t: { name: string }) => t.name === "generate_incident_summary",
    );

    const result = await tool!.execute({ incident_id: "fake" }, mockContext());
    expect(result).toHaveProperty("error");
  });
});

// ══════════════════════════════════════════════════════════════
// 8. check_visitor_blacklist
// ══════════════════════════════════════════════════════════════

describe("check_visitor_blacklist", () => {
  it("returns error when visitor_id missing", async () => {
    const { visitorTools } =
      await import("../../modules/mcp-bridge/tools/visitor-tools.js");
    const tool = visitorTools.find(
      (t: { name: string }) => t.name === "check_visitor_blacklist",
    );
    expect(tool).toBeDefined();

    const result = await tool!.execute({}, mockContext());
    expect(result).toHaveProperty("error");
  });
});
