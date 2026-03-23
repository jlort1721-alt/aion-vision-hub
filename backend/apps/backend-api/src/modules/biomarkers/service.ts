import { db } from '../../db/client.js';
import { biomarkers } from '../../db/schema/index.js';
import { eq, desc } from 'drizzle-orm';

export interface BiomarkerInput {
  tenantId: string;
  subjectId: string;
  embedding: number[];
  confidence: number;
  phenotypicMetadata?: Record<string, unknown>;
  featureTags?: string[];
  lastSeenLocationId?: string;
}

export interface BiomarkerSearchResult {
  subjectId: string;
  matchPercentage: number;
  features: string[];
  lastSeenLocationId: string | null;
  lastSeenAt: string;
}

export async function ingestBiomarker(input: BiomarkerInput) {
  const [inserted] = await db.insert(biomarkers).values({
    tenantId: input.tenantId,
    subjectId: input.subjectId,
    embedding: input.embedding,
    confidence: input.confidence,
    phenotypicMetadata: input.phenotypicMetadata || {},
    featureTags: input.featureTags || [],
    lastSeenLocationId: input.lastSeenLocationId,
  }).returning({ id: biomarkers.id });

  return inserted;
}

export async function searchBiomarkersBySimilarity(
  tenantId: string,
  _targetEmbedding: number[],
  limit = 10
): Promise<BiomarkerSearchResult[]> {
  const hits = await db
    .select({
      subjectId: biomarkers.subjectId,
      tags: biomarkers.featureTags,
      location: biomarkers.lastSeenLocationId,
      seenAt: biomarkers.lastSeenAt,
      confidence: biomarkers.confidence,
    })
    .from(biomarkers)
    .where(eq(biomarkers.tenantId, tenantId))
    .orderBy(desc(biomarkers.confidence))
    .limit(limit);

  return hits.map(hit => ({
    subjectId: hit.subjectId,
    matchPercentage: parseFloat((hit.confidence * 100).toFixed(1)),
    features: (hit.tags || []) as string[],
    lastSeenLocationId: hit.location,
    lastSeenAt: hit.seenAt.toISOString(),
  }));
}

export async function listBiomarkers(tenantId: string) {
  return db
    .select()
    .from(biomarkers)
    .where(eq(biomarkers.tenantId, tenantId))
    .orderBy(desc(biomarkers.lastSeenAt))
    .limit(50);
}
