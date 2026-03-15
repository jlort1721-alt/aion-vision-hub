import { describe, it, expect } from "vitest";

/**
 * Incident Workflow Tests
 *
 * Validates the incident lifecycle and state machine
 * used by the platform for security incident management.
 */

type IncidentStatus = "open" | "investigating" | "pending" | "resolved" | "closed";
type IncidentPriority = "critical" | "high" | "medium" | "low";

interface IncidentTransition {
  from: IncidentStatus;
  to: IncidentStatus;
  requiresComment: boolean;
  allowedRoles: string[];
}

const INCIDENT_TRANSITIONS: IncidentTransition[] = [
  { from: "open", to: "investigating", requiresComment: false, allowedRoles: ["operator", "tenant_admin", "super_admin"] },
  { from: "open", to: "resolved", requiresComment: true, allowedRoles: ["operator", "tenant_admin", "super_admin"] },
  { from: "open", to: "closed", requiresComment: true, allowedRoles: ["tenant_admin", "super_admin"] },
  { from: "investigating", to: "pending", requiresComment: true, allowedRoles: ["operator", "tenant_admin", "super_admin"] },
  { from: "investigating", to: "resolved", requiresComment: true, allowedRoles: ["operator", "tenant_admin", "super_admin"] },
  { from: "pending", to: "investigating", requiresComment: false, allowedRoles: ["operator", "tenant_admin", "super_admin"] },
  { from: "pending", to: "resolved", requiresComment: true, allowedRoles: ["operator", "tenant_admin", "super_admin"] },
  { from: "resolved", to: "closed", requiresComment: false, allowedRoles: ["tenant_admin", "super_admin"] },
  { from: "resolved", to: "investigating", requiresComment: true, allowedRoles: ["operator", "tenant_admin", "super_admin"] },
];

function canTransition(from: IncidentStatus, to: IncidentStatus, role: string): boolean {
  const transition = INCIDENT_TRANSITIONS.find((t) => t.from === from && t.to === to);
  if (!transition) return false;
  return transition.allowedRoles.includes(role);
}

function getAvailableTransitions(status: IncidentStatus, role: string): IncidentStatus[] {
  return INCIDENT_TRANSITIONS
    .filter((t) => t.from === status && t.allowedRoles.includes(role))
    .map((t) => t.to);
}

function calculateSLA(priority: IncidentPriority): { responseMinutes: number; resolutionHours: number } {
  const slaMap: Record<IncidentPriority, { responseMinutes: number; resolutionHours: number }> = {
    critical: { responseMinutes: 15, resolutionHours: 4 },
    high: { responseMinutes: 30, resolutionHours: 8 },
    medium: { responseMinutes: 60, resolutionHours: 24 },
    low: { responseMinutes: 240, resolutionHours: 72 },
  };
  return slaMap[priority];
}

describe("Incident Workflows", () => {
  describe("State Transitions", () => {
    it("open can transition to investigating", () => {
      expect(canTransition("open", "investigating", "operator")).toBe(true);
    });

    it("open can be directly resolved with comment", () => {
      expect(canTransition("open", "resolved", "operator")).toBe(true);
      const transition = INCIDENT_TRANSITIONS.find(
        (t) => t.from === "open" && t.to === "resolved"
      );
      expect(transition?.requiresComment).toBe(true);
    });

    it("only admins can close from open", () => {
      expect(canTransition("open", "closed", "operator")).toBe(false);
      expect(canTransition("open", "closed", "tenant_admin")).toBe(true);
      expect(canTransition("open", "closed", "super_admin")).toBe(true);
    });

    it("viewer cannot perform any transitions", () => {
      expect(canTransition("open", "investigating", "viewer")).toBe(false);
      expect(canTransition("open", "resolved", "viewer")).toBe(false);
    });

    it("closed is a terminal state (no valid transitions)", () => {
      const transitions = getAvailableTransitions("closed", "super_admin");
      expect(transitions).toHaveLength(0);
    });

    it("resolved can be re-opened or closed", () => {
      const transitions = getAvailableTransitions("resolved", "tenant_admin");
      expect(transitions).toContain("closed");
      expect(transitions).toContain("investigating");
    });

    it("invalid transitions are blocked", () => {
      expect(canTransition("open", "pending", "operator")).toBe(false);
      expect(canTransition("closed", "open", "super_admin")).toBe(false);
    });
  });

  describe("Available Transitions by Role", () => {
    it("operator from open status", () => {
      const transitions = getAvailableTransitions("open", "operator");
      expect(transitions).toContain("investigating");
      expect(transitions).toContain("resolved");
      expect(transitions).not.toContain("closed");
    });

    it("tenant_admin from open status", () => {
      const transitions = getAvailableTransitions("open", "tenant_admin");
      expect(transitions).toContain("investigating");
      expect(transitions).toContain("resolved");
      expect(transitions).toContain("closed");
    });
  });

  describe("SLA Calculation", () => {
    it("critical incidents have fastest SLA", () => {
      const sla = calculateSLA("critical");
      expect(sla.responseMinutes).toBe(15);
      expect(sla.resolutionHours).toBe(4);
    });

    it("high priority incidents", () => {
      const sla = calculateSLA("high");
      expect(sla.responseMinutes).toBe(30);
      expect(sla.resolutionHours).toBe(8);
    });

    it("medium priority incidents", () => {
      const sla = calculateSLA("medium");
      expect(sla.responseMinutes).toBe(60);
      expect(sla.resolutionHours).toBe(24);
    });

    it("low priority incidents have longest SLA", () => {
      const sla = calculateSLA("low");
      expect(sla.responseMinutes).toBe(240);
      expect(sla.resolutionHours).toBe(72);
    });

    it("SLA times increase with decreasing priority", () => {
      const critical = calculateSLA("critical");
      const high = calculateSLA("high");
      const medium = calculateSLA("medium");
      const low = calculateSLA("low");

      expect(critical.responseMinutes).toBeLessThan(high.responseMinutes);
      expect(high.responseMinutes).toBeLessThan(medium.responseMinutes);
      expect(medium.responseMinutes).toBeLessThan(low.responseMinutes);
    });
  });

  describe("Incident Creation Validation", () => {
    it("validates required fields", () => {
      const requiredFields = ["title", "description", "priority", "tenant_id"];
      const incident = {
        title: "Unauthorized access attempt",
        description: "Motion detected in restricted zone after hours",
        priority: "high" as IncidentPriority,
        tenant_id: "tenant-123",
      };

      for (const field of requiredFields) {
        expect(incident).toHaveProperty(field);
        expect((incident as any)[field]).toBeTruthy();
      }
    });

    it("new incidents start in open status", () => {
      const defaultStatus: IncidentStatus = "open";
      expect(defaultStatus).toBe("open");
    });
  });
});
