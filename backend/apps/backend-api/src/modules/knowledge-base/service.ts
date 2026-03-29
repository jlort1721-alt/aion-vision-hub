/**
 * Knowledge Base Service — RAG pipeline for AION Agent
 * Stores operational knowledge, SOPs, and learned patterns.
 * Uses PostgreSQL full-text search (no external vector DB needed).
 */
import { db } from '../../db/client.js';
import { sql } from 'drizzle-orm';
import { createLogger } from '@aion/common-utils';

const logger = createLogger({ name: 'knowledge-base' });

export interface KnowledgeEntry {
  id: string;
  category: string; // 'sop', 'incident_resolution', 'device_manual', 'operator_note', 'system_pattern'
  title: string;
  content: string;
  tags: string[];
  source: string; // 'manual', 'ai_generated', 'incident_#123', 'shift_report'
  relevance_score?: number;
  created_at: string;
}

export class KnowledgeBaseService {

  /** Search knowledge base using full-text search */
  async search(query: string, limit = 5): Promise<KnowledgeEntry[]> {
    try {
      const results = await db.execute(sql`
        SELECT id, category, title, content, tags, source, created_at,
          ts_rank(to_tsvector('spanish', title || ' ' || content), plainto_tsquery('spanish', ${query})) as relevance_score
        FROM knowledge_base
        WHERE to_tsvector('spanish', title || ' ' || content) @@ plainto_tsquery('spanish', ${query})
        ORDER BY relevance_score DESC
        LIMIT ${limit}
      `);
      return results as unknown as KnowledgeEntry[];
    } catch {
      // Table might not exist yet, return empty
      logger.warn('Knowledge base search failed — table may not exist yet');
      return [];
    }
  }

  /** Add new knowledge entry */
  async add(entry: Omit<KnowledgeEntry, 'id' | 'created_at' | 'relevance_score'>): Promise<void> {
    await db.execute(sql`
      INSERT INTO knowledge_base (category, title, content, tags, source)
      VALUES (${entry.category}, ${entry.title}, ${entry.content}, ${entry.tags}, ${entry.source})
    `);
    logger.info({ category: entry.category, title: entry.title }, 'Knowledge entry added');
  }

  /** Update an existing knowledge entry */
  async update(id: string, entry: Partial<Omit<KnowledgeEntry, 'id' | 'created_at' | 'relevance_score'>>): Promise<void> {
    const sets: string[] = [];
    const values: unknown[] = [];
    if (entry.category) { sets.push('category'); values.push(entry.category); }
    if (entry.title) { sets.push('title'); values.push(entry.title); }
    if (entry.content) { sets.push('content'); values.push(entry.content); }
    if (entry.tags) { sets.push('tags'); values.push(entry.tags); }
    if (entry.source) { sets.push('source'); values.push(entry.source); }
    if (sets.length === 0) return;

    await db.execute(sql`
      UPDATE knowledge_base SET
        category = COALESCE(${entry.category ?? null}, category),
        title = COALESCE(${entry.title ?? null}, title),
        content = COALESCE(${entry.content ?? null}, content),
        tags = COALESCE(${entry.tags ?? null}, tags),
        source = COALESCE(${entry.source ?? null}, source),
        updated_at = NOW()
      WHERE id = ${id}
    `);
    logger.info({ id }, 'Knowledge entry updated');
  }

  /** Delete a knowledge entry */
  async remove(id: string): Promise<void> {
    await db.execute(sql`DELETE FROM knowledge_base WHERE id = ${id}`);
    logger.info({ id }, 'Knowledge entry deleted');
  }

  /** List all entries with optional limit */
  async listAll(limit = 50): Promise<KnowledgeEntry[]> {
    try {
      const results = await db.execute(sql`
        SELECT * FROM knowledge_base ORDER BY created_at DESC LIMIT ${limit}
      `);
      return results as unknown as KnowledgeEntry[];
    } catch {
      logger.warn('Knowledge base listAll failed — table may not exist yet');
      return [];
    }
  }

  /** Learn from resolved incident */
  async learnFromIncident(incidentId: string, resolution: string): Promise<void> {
    await this.add({
      category: 'incident_resolution',
      title: `Incident ${incidentId} resolution`,
      content: resolution,
      tags: ['incident', 'resolution', 'learned'],
      source: `incident_${incidentId}`,
    });
  }

  /** Build context for AI agent from relevant knowledge */
  async buildContext(query: string): Promise<string> {
    const entries = await this.search(query, 3);
    if (entries.length === 0) return '';
    return '\n\n--- Conocimiento relevante del sistema ---\n' +
      entries.map(e => `[${e.category}] ${e.title}:\n${e.content}`).join('\n\n');
  }

  /** Get all entries by category */
  async listByCategory(category: string): Promise<KnowledgeEntry[]> {
    try {
      const results = await db.execute(sql`
        SELECT * FROM knowledge_base WHERE category = ${category} ORDER BY created_at DESC LIMIT 50
      `);
      return results as unknown as KnowledgeEntry[];
    } catch {
      logger.warn('Knowledge base listByCategory failed — table may not exist yet');
      return [];
    }
  }
}

export const knowledgeBase = new KnowledgeBaseService();
