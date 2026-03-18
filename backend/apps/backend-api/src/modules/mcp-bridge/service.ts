import { eq, and } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { mcpConnectors } from '../../db/schema/index.js';
import { AppError, ErrorCodes } from '@aion/shared-contracts';
import type { MCPTool, MCPToolResult } from '@aion/shared-contracts';
import type { ExecuteToolInput } from './schemas.js';

/**
 * Extended MCPTool type that includes optional requiredScopes.
 * Tools defined in the connector config may carry a requiredScopes
 * array that is not part of the base MCPTool contract.
 */
interface MCPToolWithScopes extends MCPTool {
  requiredScopes?: string[];
}

export class MCPBridgeService {
  /**
   * List all available MCP tools across active connectors for a tenant.
   * Aggregates the tools array from each connector's config, tagging each tool
   * with its source connector ID.
   */
  async listTools(tenantId: string): Promise<MCPTool[]> {
    const connectors = await db
      .select()
      .from(mcpConnectors)
      .where(
        and(eq(mcpConnectors.tenantId, tenantId), eq(mcpConnectors.health, 'healthy')),
      );

    const tools: MCPTool[] = [];

    for (const connector of connectors) {
      const cfg = connector.config as Record<string, unknown>;
      const connectorTools = (cfg?.tools ?? []) as MCPTool[];
      for (const tool of connectorTools) {
        tools.push({
          ...tool,
          connectorId: connector.id,
        });
      }
    }

    return tools;
  }

  /**
   * List all MCP connectors for a tenant.
   */
  async listConnectors(tenantId: string) {
    return db
      .select()
      .from(mcpConnectors)
      .where(eq(mcpConnectors.tenantId, tenantId));
  }

  /**
   * Execute an MCP tool by name.
   * Finds the connector that provides the tool, then proxies the execution
   * request to the connector's endpoint.
   */
  async execute(tenantId: string, input: ExecuteToolInput): Promise<MCPToolResult> {
    const { toolName, params } = input;

    // Find the connector that provides this tool
    const connectors = await db
      .select()
      .from(mcpConnectors)
      .where(
        and(eq(mcpConnectors.tenantId, tenantId), eq(mcpConnectors.health, 'healthy')),
      );

    let targetConnector: typeof connectors[number] | null = null;
    let matchedTool: MCPToolWithScopes | null = null;

    for (const connector of connectors) {
      const cfg = connector.config as Record<string, unknown>;
      const connectorTools = (cfg?.tools ?? []) as MCPToolWithScopes[];
      const tool = connectorTools.find((t) => t.name === toolName);
      if (tool) {
        targetConnector = connector;
        matchedTool = tool;
        break;
      }
    }

    if (!targetConnector || !matchedTool) {
      throw new AppError(
        ErrorCodes.MCP_TOOL_NOT_FOUND,
        `Tool '${toolName}' not found in any active connector`,
        404,
      );
    }

    // ── Scope enforcement ──────────────────────────────────────
    // Validate that the connector's granted scopes include every
    // scope required by the tool. This prevents execution of tools
    // whose scopes have been revoked or were never granted.
    const requiredScopes = matchedTool.requiredScopes;
    if (requiredScopes && requiredScopes.length > 0) {
      const connectorScopes = targetConnector.scopes ?? [];
      const missingScopes = requiredScopes.filter(
        (scope) => !connectorScopes.includes(scope),
      );

      if (missingScopes.length > 0) {
        throw new AppError(
          ErrorCodes.AUTH_INSUFFICIENT_ROLE,
          `Connector '${targetConnector.name}' is missing required scopes for tool '${toolName}': ${missingScopes.join(', ')}`,
          403,
          {
            connectorId: targetConnector.id,
            toolName,
            requiredScopes,
            missingScopes,
            grantedScopes: connectorScopes,
          },
        );
      }
    }

    // Proxy execution to the connector's endpoint
    const startTime = Date.now();

    try {
      const response = await fetch(`${targetConnector.endpoint}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: toolName,
          params,
        }),
        signal: AbortSignal.timeout(30000),
      });

      const executionMs = Date.now() - startTime;

      if (!response.ok) {
        const errorBody = await response.text();
        throw new AppError(
          ErrorCodes.MCP_EXECUTION_FAILED,
          `Tool execution failed (HTTP ${response.status}): ${errorBody}`,
          502,
        );
      }

      const data = await response.json();

      // Update last health check timestamp
      await db
        .update(mcpConnectors)
        .set({ lastCheck: new Date(), updatedAt: new Date() })
        .where(eq(mcpConnectors.id, targetConnector.id));

      return {
        success: true,
        data,
        executionMs,
      };
    } catch (error) {
      const executionMs = Date.now() - startTime;

      if (error instanceof AppError) throw error;

      const message = error instanceof Error ? error.message : 'Unknown execution error';

      throw new AppError(
        ErrorCodes.MCP_EXECUTION_FAILED,
        `Tool '${toolName}' execution failed: ${message}`,
        502,
        { executionMs, connectorId: targetConnector.id },
      );
    }
  }
}

export const mcpBridgeService = new MCPBridgeService();
