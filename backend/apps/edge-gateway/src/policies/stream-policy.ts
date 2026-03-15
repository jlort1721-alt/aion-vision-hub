import type { StreamType, StreamProfile } from '@aion/shared-contracts';
import { DEFAULT_STREAM_POLICY, type StreamContext, type StreamPolicyConfig } from '@aion/shared-contracts';

/**
 * Stream selection policy engine.
 * Determines which stream type (main/sub/third) to use based on viewing context,
 * available profiles, and concurrency limits.
 */
export class StreamPolicyEngine {
  private policy: StreamPolicyConfig;
  private activeMainStreams = 0;
  private activeSubStreams = 0;

  constructor(policy?: Partial<StreamPolicyConfig>) {
    this.policy = { ...DEFAULT_STREAM_POLICY, ...policy };
  }

  selectProfile(profiles: StreamProfile[], context: StreamContext): StreamProfile | null {
    const preferred = this.policy[context];

    // Check concurrency limits
    if (preferred === 'main' && this.activeMainStreams >= this.policy.maxConcurrentMainStreams) {
      // Fall back to sub if main stream limit reached
      const sub = profiles.find((p) => p.type === 'sub');
      if (sub) return sub;
    }

    // Try preferred type first
    const match = profiles.find((p) => p.type === preferred);
    if (match) return match;

    // Fallback chain
    for (const fallback of this.policy.fallbackOrder) {
      const profile = profiles.find((p) => p.type === fallback);
      if (profile) return profile;
    }

    return profiles[0] ?? null;
  }

  acquireStream(type: StreamType): boolean {
    if (type === 'main') {
      if (this.activeMainStreams >= this.policy.maxConcurrentMainStreams) return false;
      this.activeMainStreams++;
    } else {
      if (this.activeSubStreams >= this.policy.maxConcurrentSubStreams) return false;
      this.activeSubStreams++;
    }
    return true;
  }

  releaseStream(type: StreamType): void {
    if (type === 'main') {
      this.activeMainStreams = Math.max(0, this.activeMainStreams - 1);
    } else {
      this.activeSubStreams = Math.max(0, this.activeSubStreams - 1);
    }
  }

  getStats() {
    return {
      activeMainStreams: this.activeMainStreams,
      activeSubStreams: this.activeSubStreams,
      maxMainStreams: this.policy.maxConcurrentMainStreams,
      maxSubStreams: this.policy.maxConcurrentSubStreams,
    };
  }
}
