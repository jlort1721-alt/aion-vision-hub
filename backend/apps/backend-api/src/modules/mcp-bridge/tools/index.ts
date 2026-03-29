/**
 * MCP Server Tools — Registry
 *
 * Central registry for all MCP server tools. Each tool implements the
 * MCPServerTool interface and is registered here for discovery and execution
 * by the MCP bridge service.
 */

import { db } from '../../../db/client.js';
import { auditLogs } from '../../../db/schema/index.js';

// ── MCPServerTool Interface ──────────────────────────────────

export interface MCPServerTool {
  /** Unique tool name used for invocation */
  name: string;
  /** Human-readable description of what the tool does */
  description: string;
  /** Parameter definitions for the tool */
  parameters: Record<
    string,
    {
      type: string;
      description: string;
      required?: boolean;
      enum?: string[];
    }
  >;
  /** Execute the tool with given parameters and security context */
  execute: (
    params: Record<string, unknown>,
    context: { tenantId: string; userId: string },
  ) => Promise<unknown>;
}

// ── Tool Imports ─────────────────────────────────────────────

import { dbReadTools } from './db-read.js';
import { incidentServerTools } from './incident-server.js';
import { deviceCommandTools } from './device-command.js';
import { notificationServerTools } from './notification-server.js';
import { reportServerTools } from './report-server.js';
import { ewelinkTools } from './ewelink-tools.js';
import { eventActionTools } from './event-action-tools.js';
import { accessControlTools } from './access-control-tools.js';
import { alertTools } from './alert-tools.js';
import { emergencyTools } from './emergency-tools.js';
import { operationsTools } from './operations-tools.js';
import { visitorTools } from './visitor-tools.js';
import { managementTools } from './management-tools.js';
import { complianceTrainingTools } from './compliance-training-tools.js';
import { anomalyTools } from './anomaly-tools.js';
import { knowledgeTools } from './knowledge-tools.js';
import { automationQueryTools } from './automation-query-tools.js';
import { aiSummaryTools } from './ai-summary-tools.js';
import { hikvisionISAPITools } from './hikvision-isapi-tools.js';

// ── Tool Registry ────────────────────────────────────────────

/** All registered MCP server tools, indexed by name for O(1) lookup */
const toolRegistry = new Map<string, MCPServerTool>();

/** Flat array of all tools for listing */
const allTools: MCPServerTool[] = [
  ...dbReadTools,
  ...incidentServerTools,
  ...deviceCommandTools,
  ...notificationServerTools,
  ...reportServerTools,
  ...ewelinkTools,
  ...eventActionTools,
  ...accessControlTools,
  ...alertTools,
  ...emergencyTools,
  ...operationsTools,
  ...visitorTools,
  ...managementTools,
  ...complianceTrainingTools,
  ...anomalyTools,
  ...knowledgeTools,
  ...automationQueryTools,
  ...aiSummaryTools,
  ...hikvisionISAPITools,
];

// Populate the registry
for (const tool of allTools) {
  if (toolRegistry.has(tool.name)) {
    throw new Error(`Duplicate MCP tool name: '${tool.name}'. Each tool must have a unique name.`);
  }
  toolRegistry.set(tool.name, tool);
}

// ── Public API ───────────────────────────────────────────────

/**
 * Get all registered MCP server tools.
 */
export function getAllTools(): MCPServerTool[] {
  return allTools;
}

/**
 * Get a specific tool by name.
 */
export function getTool(name: string): MCPServerTool | undefined {
  return toolRegistry.get(name);
}

/**
 * Check if a tool exists.
 */
export function hasTool(name: string): boolean {
  return toolRegistry.has(name);
}

/**
 * Execute a tool by name with audit logging.
 * This is the main entry point for the MCP bridge service.
 */
export async function executeTool(
  toolName: string,
  params: Record<string, unknown>,
  context: { tenantId: string; userId: string },
): Promise<{
  success: boolean;
  data?: unknown;
  error?: string;
  executionMs: number;
  toolName: string;
}> {
  const tool = toolRegistry.get(toolName);
  if (!tool) {
    return {
      success: false,
      error: `MCP server tool '${toolName}' not found. Available tools: ${Array.from(toolRegistry.keys()).join(', ')}`,
      executionMs: 0,
      toolName,
    };
  }

  const startTime = Date.now();

  try {
    // Validate required parameters
    const missingRequired: string[] = [];
    for (const [paramName, paramDef] of Object.entries(tool.parameters)) {
      if (paramDef.required && (params[paramName] === undefined || params[paramName] === null || params[paramName] === '')) {
        missingRequired.push(paramName);
      }
    }

    if (missingRequired.length > 0) {
      const executionMs = Date.now() - startTime;

      // Audit the failed attempt
      await db.insert(auditLogs).values({
        tenantId: context.tenantId,
        userId: context.userId,
        userEmail: 'mcp-agent',
        action: `mcp.tool.${toolName}`,
        entityType: 'mcp-tool',
        entityId: toolName,
        afterState: {
          success: false,
          error: `Missing required parameters: ${missingRequired.join(', ')}`,
          params,
          executionMs,
        },
      });

      return {
        success: false,
        error: `Missing required parameters: ${missingRequired.join(', ')}`,
        executionMs,
        toolName,
      };
    }

    // Validate enum parameters
    for (const [paramName, paramDef] of Object.entries(tool.parameters)) {
      if (paramDef.enum && params[paramName] !== undefined && params[paramName] !== null) {
        const value = String(params[paramName]);
        if (!paramDef.enum.includes(value)) {
          const executionMs = Date.now() - startTime;
          return {
            success: false,
            error: `Invalid value '${value}' for parameter '${paramName}'. Must be one of: ${paramDef.enum.join(', ')}`,
            executionMs,
            toolName,
          };
        }
      }
    }

    // Execute the tool
    const result = await tool.execute(params, context);
    const executionMs = Date.now() - startTime;

    // Audit successful execution
    await db.insert(auditLogs).values({
      tenantId: context.tenantId,
      userId: context.userId,
      userEmail: 'mcp-agent',
      action: `mcp.tool.${toolName}`,
      entityType: 'mcp-tool',
      entityId: toolName,
      afterState: {
        success: true,
        executionMs,
        params,
      },
    });

    return {
      success: true,
      data: result,
      executionMs,
      toolName,
    };
  } catch (error) {
    const executionMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown tool execution error';

    // Audit failed execution
    await db.insert(auditLogs).values({
      tenantId: context.tenantId,
      userId: context.userId,
      userEmail: 'mcp-agent',
      action: `mcp.tool.${toolName}`,
      entityType: 'mcp-tool',
      entityId: toolName,
      afterState: {
        success: false,
        error: errorMessage,
        executionMs,
        params,
      },
    }).catch(() => {
      // Non-blocking audit failure
    });

    return {
      success: false,
      error: errorMessage,
      executionMs,
      toolName,
    };
  }
}

/**
 * Get tool descriptors for listing (without the execute function).
 * Suitable for the /tools endpoint response.
 */
export function getToolDescriptors(): Array<{
  name: string;
  description: string;
  parameters: MCPServerTool['parameters'];
}> {
  return allTools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }));
}

/**
 * Get the total count of registered tools.
 */
export function getToolCount(): number {
  return toolRegistry.size;
}
