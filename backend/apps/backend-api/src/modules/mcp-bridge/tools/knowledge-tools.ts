/**
 * MCP Server Tool — Knowledge Base
 *
 * Provides tools for full-text searching and adding entries to the
 * knowledge base. Supports category-based organization and tagging.
 * All operations are tenant-scoped.
 */

import { eq, and, sql, or, ilike, desc } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import { knowledgeBase } from '../../../db/schema/index.js';
import type { MCPServerTool } from './index.js';

// ── search_knowledge ─────────────────────────────────────────

export const searchKnowledge: MCPServerTool = {
  name: 'search_knowledge',
  description:
    'Full-text search the knowledge base by title, content, category, or tags. Returns matching entries ranked by relevance.',
  parameters: {
    query: {
      type: 'string',
      description: 'Search term to match against title, content, and tags (required)',
      required: true,
    },
    category: {
      type: 'string',
      description: 'Filter by category (optional)',
      required: false,
    },
    limit: {
      type: 'number',
      description: 'Maximum number of results (default: 20, max: 50)',
      required: false,
    },
  },
  execute: async (params, context) => {
    try {
      const query = params.query as string;
      if (!query) {
        return { error: 'query is required' };
      }

      const limit = Math.min(Math.max(Number(params.limit) || 20, 1), 50);
      const searchPattern = `%${query}%`;

      const conditions = [
        or(
          eq(knowledgeBase.tenantId, context.tenantId),
          sql`${knowledgeBase.tenantId} is null`,
        ),
        or(
          ilike(knowledgeBase.title, searchPattern),
          ilike(knowledgeBase.content, searchPattern),
          ilike(knowledgeBase.category, searchPattern),
          sql`exists (select 1 from unnest(${knowledgeBase.tags}) as t where t ilike ${searchPattern})`,
        ),
      ];

      if (params.category) {
        conditions.push(eq(knowledgeBase.category, params.category as string));
      }

      const rows = await db
        .select({
          id: knowledgeBase.id,
          category: knowledgeBase.category,
          title: knowledgeBase.title,
          content: knowledgeBase.content,
          tags: knowledgeBase.tags,
          source: knowledgeBase.source,
          createdAt: knowledgeBase.createdAt,
          updatedAt: knowledgeBase.updatedAt,
        })
        .from(knowledgeBase)
        .where(and(...conditions))
        .orderBy(desc(knowledgeBase.updatedAt))
        .limit(limit);

      return {
        results: rows,
        returned: rows.length,
        search_term: query,
        category_filter: (params.category as string) ?? null,
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to search knowledge base' };
    }
  },
};

// ── add_knowledge ────────────────────────────────────────────

export const addKnowledge: MCPServerTool = {
  name: 'add_knowledge',
  description:
    'Add a new entry to the knowledge base with a category, title, content, and optional tags.',
  parameters: {
    category: {
      type: 'string',
      description: 'Category for the entry (e.g., "procedures", "troubleshooting", "policies") (required)',
      required: true,
    },
    title: {
      type: 'string',
      description: 'Title of the knowledge entry (required)',
      required: true,
    },
    content: {
      type: 'string',
      description: 'Full content/body of the knowledge entry (required)',
      required: true,
    },
    tags: {
      type: 'string',
      description: 'Comma-separated list of tags for the entry',
      required: false,
    },
  },
  execute: async (params, context) => {
    try {
      const category = params.category as string;
      const title = params.title as string;
      const content = params.content as string;

      if (!category || !title || !content) {
        return { error: 'category, title, and content are required' };
      }

      const tags: string[] = params.tags
        ? (params.tags as string).split(',').map((t) => t.trim()).filter(Boolean)
        : [];

      const [entry] = await db
        .insert(knowledgeBase)
        .values({
          tenantId: context.tenantId,
          category,
          title,
          content,
          tags,
          source: 'mcp-agent',
        })
        .returning();

      return {
        message: 'Knowledge entry added successfully',
        entry: {
          id: entry.id,
          category: entry.category,
          title: entry.title,
          tags: entry.tags,
          source: entry.source,
          createdAt: entry.createdAt,
        },
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to add knowledge entry' };
    }
  },
};

/** All knowledge base tools */
export const knowledgeTools: MCPServerTool[] = [
  searchKnowledge,
  addKnowledge,
];
