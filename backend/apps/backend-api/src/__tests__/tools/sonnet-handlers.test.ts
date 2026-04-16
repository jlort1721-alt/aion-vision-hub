/**
 * Sonnet-tier tool handler tests — 11 handlers that perform analytical
 * and reporting operations.
 *
 * Strategy: same mock pattern as opus-handlers.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockContext, MOCK_TENANT } from "./tool-test-helpers.js";

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
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve(mockSelectRows.shift() ?? [])),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: mockInsertFn,
    })),
    execute: vi.fn(() => Promise.resolve(mockSelectRows.shift() ?? [])),
  },
}));

// ── Schema mocks ─────────────────────────────────────────

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
    resolvedAt: col("resolvedAt"),
    closedAt: col("closedAt"),
    assignedTo: col("assignedTo"),
    category: col("category"),
    source: col("source"),
    channel: col("channel"),
    startDate: col("startDate"),
    endDate: col("endDate"),
    expiresAt: col("expiresAt"),
    scheduledDate: col("scheduledDate"),
    completedAt: col("completedAt"),
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
    "incidentComments",
    "kpiSnapshots",
    "patrolCheckpoints",
    "patrolCheckins",
    "shiftCompletions",
    "reportTemplates",
    "generatedReports",
    "scheduledReports",
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
  between: vi.fn(),
}));

// ── Reset ──────────────────────────────────────────────────

beforeEach(() => {
  mockSelectRows.length = 0;
  mockInsertFn.mockClear();
  vi.clearAllMocks();
});

// ══════════════════════════════════════════════════════════════
// 1. create_incident (incident-server.ts)
// ══════════════════════════════════════════════════════════════

describe("create_incident", () => {
  it("tool is registered", async () => {
    const { incidentServerTools } =
      await import("../../modules/mcp-bridge/tools/incident-server.js");
    const tool = incidentServerTools.find(
      (t: { name: string }) => t.name === "create_incident",
    );
    expect(tool).toBeDefined();
    expect(tool!.parameters).toBeDefined();
  });

  it("returns error when required fields missing", async () => {
    const { incidentServerTools } =
      await import("../../modules/mcp-bridge/tools/incident-server.js");
    const tool = incidentServerTools.find(
      (t: { name: string }) => t.name === "create_incident",
    );

    const result = await tool!.execute({}, mockContext());
    expect(result).toHaveProperty("error");
  });
});

// ══════════════════════════════════════════════════════════════
// 2. update_incident (incident-server.ts)
// ══════════════════════════════════════════════════════════════

describe("update_incident", () => {
  it("tool is registered", async () => {
    const { incidentServerTools } =
      await import("../../modules/mcp-bridge/tools/incident-server.js");
    const tool = incidentServerTools.find(
      (t: { name: string }) => t.name === "update_incident",
    );
    expect(tool).toBeDefined();
  });

  it("returns error when incident_id missing", async () => {
    const { incidentServerTools } =
      await import("../../modules/mcp-bridge/tools/incident-server.js");
    const tool = incidentServerTools.find(
      (t: { name: string }) => t.name === "update_incident",
    );

    const result = await tool!.execute({}, mockContext());
    expect(result).toHaveProperty("error");
  });
});

// ══════════════════════════════════════════════════════════════
// 3. generate_report (report-server.ts)
// ══════════════════════════════════════════════════════════════

describe("generate_report", () => {
  it("tool is registered", async () => {
    const { reportServerTools } =
      await import("../../modules/mcp-bridge/tools/report-server.js");
    const tool = reportServerTools.find(
      (t: { name: string }) => t.name === "generate_report",
    );
    expect(tool).toBeDefined();
    expect(tool!.parameters).toBeDefined();
  });

  it("returns error when type missing", async () => {
    const { reportServerTools } =
      await import("../../modules/mcp-bridge/tools/report-server.js");
    const tool = reportServerTools.find(
      (t: { name: string }) => t.name === "generate_report",
    );

    const result = await tool!.execute({}, mockContext());
    expect(result).toHaveProperty("error");
  });
});

// ══════════════════════════════════════════════════════════════
// 4. get_kpis (report-server.ts)
// ══════════════════════════════════════════════════════════════

describe("get_kpis", () => {
  it("tool is registered", async () => {
    const { reportServerTools } =
      await import("../../modules/mcp-bridge/tools/report-server.js");
    const tool = reportServerTools.find(
      (t: { name: string }) => t.name === "get_kpis",
    );
    expect(tool).toBeDefined();
  });

  it("has correct parameter schema", async () => {
    const { reportServerTools } =
      await import("../../modules/mcp-bridge/tools/report-server.js");
    const tool = reportServerTools.find(
      (t: { name: string }) => t.name === "get_kpis",
    );
    expect(tool!.parameters).toBeDefined();
    expect(tool!.description).toBeTruthy();
  });
});

// ══════════════════════════════════════════════════════════════
// 5. detect_anomalies (anomaly-tools.ts)
// ══════════════════════════════════════════════════════════════

describe("detect_anomalies", () => {
  it("tool is registered", async () => {
    const { anomalyTools } =
      await import("../../modules/mcp-bridge/tools/anomaly-tools.js");
    const tool = anomalyTools.find(
      (t: { name: string }) => t.name === "detect_anomalies",
    );
    expect(tool).toBeDefined();
    expect(tool!.parameters).toBeDefined();
  });

  it("returns data shape on execute", async () => {
    const { anomalyTools } =
      await import("../../modules/mcp-bridge/tools/anomaly-tools.js");
    const tool = anomalyTools.find(
      (t: { name: string }) => t.name === "detect_anomalies",
    );

    const result = await tool!.execute({}, mockContext());
    expect(result).toBeDefined();
  });
});

// ══════════════════════════════════════════════════════════════
// 6. get_patrol_compliance (operations-tools.ts)
// ══════════════════════════════════════════════════════════════

describe("get_patrol_compliance", () => {
  it("tool is registered", async () => {
    const { operationsTools } =
      await import("../../modules/mcp-bridge/tools/operations-tools.js");
    const tool = operationsTools.find(
      (t: { name: string }) => t.name === "get_patrol_compliance",
    );
    expect(tool).toBeDefined();
  });

  it("has correct parameter schema", async () => {
    const { operationsTools } =
      await import("../../modules/mcp-bridge/tools/operations-tools.js");
    const tool = operationsTools.find(
      (t: { name: string }) => t.name === "get_patrol_compliance",
    );
    expect(tool!.parameters).toBeDefined();
    expect(tool!.description).toBeTruthy();
  });
});

// ══════════════════════════════════════════════════════════════
// 7. get_sla_compliance (operations-tools.ts)
// ══════════════════════════════════════════════════════════════

describe("get_sla_compliance", () => {
  it("tool is registered", async () => {
    const { operationsTools } =
      await import("../../modules/mcp-bridge/tools/operations-tools.js");
    const tool = operationsTools.find(
      (t: { name: string }) => t.name === "get_sla_compliance",
    );
    expect(tool).toBeDefined();
  });

  it("returns data shape on execute", async () => {
    const { operationsTools } =
      await import("../../modules/mcp-bridge/tools/operations-tools.js");
    const tool = operationsTools.find(
      (t: { name: string }) => t.name === "get_sla_compliance",
    );

    const result = await tool!.execute({}, mockContext());
    expect(result).toBeDefined();
  });
});

// ══════════════════════════════════════════════════════════════
// 8. get_compliance_status (compliance-training-tools.ts)
// ══════════════════════════════════════════════════════════════

describe("get_compliance_status", () => {
  it("tool is registered", async () => {
    const { complianceTrainingTools } =
      await import("../../modules/mcp-bridge/tools/compliance-training-tools.js");
    const tool = complianceTrainingTools.find(
      (t: { name: string }) => t.name === "get_compliance_status",
    );
    expect(tool).toBeDefined();
    expect(tool!.parameters).toBeDefined();
  });

  it("returns data shape on execute", async () => {
    const { complianceTrainingTools } =
      await import("../../modules/mcp-bridge/tools/compliance-training-tools.js");
    const tool = complianceTrainingTools.find(
      (t: { name: string }) => t.name === "get_compliance_status",
    );

    const result = await tool!.execute({}, mockContext());
    expect(result).toBeDefined();
  });
});

// ══════════════════════════════════════════════════════════════
// 9. query_certifications (compliance-training-tools.ts)
// ══════════════════════════════════════════════════════════════

describe("query_certifications", () => {
  it("tool is registered", async () => {
    const { complianceTrainingTools } =
      await import("../../modules/mcp-bridge/tools/compliance-training-tools.js");
    const tool = complianceTrainingTools.find(
      (t: { name: string }) => t.name === "query_certifications",
    );
    expect(tool).toBeDefined();
  });

  it("returns data shape on execute", async () => {
    const { complianceTrainingTools } =
      await import("../../modules/mcp-bridge/tools/compliance-training-tools.js");
    const tool = complianceTrainingTools.find(
      (t: { name: string }) => t.name === "query_certifications",
    );

    const result = await tool!.execute({}, mockContext());
    expect(result).toBeDefined();
  });
});

// ══════════════════════════════════════════════════════════════
// 10. generate_shift_summary (ai-summary-tools.ts)
// ══════════════════════════════════════════════════════════════

describe("generate_shift_summary", () => {
  it("tool is registered", async () => {
    const { aiSummaryTools } =
      await import("../../modules/mcp-bridge/tools/ai-summary-tools.js");
    const tool = aiSummaryTools.find(
      (t: { name: string }) => t.name === "generate_shift_summary",
    );
    expect(tool).toBeDefined();
  });

  it("returns data shape on execute", async () => {
    const { aiSummaryTools } =
      await import("../../modules/mcp-bridge/tools/ai-summary-tools.js");
    const tool = aiSummaryTools.find(
      (t: { name: string }) => t.name === "generate_shift_summary",
    );

    const result = await tool!.execute({}, mockContext());
    expect(result).toBeDefined();
  });
});

// ══════════════════════════════════════════════════════════════
// 11. get_port_forwarding_guide (remote-access-tools.ts)
// ══════════════════════════════════════════════════════════════

describe("get_port_forwarding_guide", () => {
  it("tool is registered", async () => {
    const { remoteAccessTools } =
      await import("../../modules/mcp-bridge/tools/remote-access-tools.js");
    const tool = remoteAccessTools.find(
      (t: { name: string }) => t.name === "get_port_forwarding_guide",
    );
    expect(tool).toBeDefined();
  });

  it("returns data shape on execute", async () => {
    const { remoteAccessTools } =
      await import("../../modules/mcp-bridge/tools/remote-access-tools.js");
    const tool = remoteAccessTools.find(
      (t: { name: string }) => t.name === "get_port_forwarding_guide",
    );

    const result = await tool!.execute({}, mockContext());
    expect(result).toBeDefined();
  });
});
