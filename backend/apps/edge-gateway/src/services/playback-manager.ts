import type pino from 'pino';
import type { PlaybackSearchParams, PlaybackSegment, PlaybackStartParams, PlaybackSession, ClipExportParams, ExportJob } from '@aion/shared-contracts';
import type { DeviceManager } from './device-manager.js';

/**
 * Manages playback sessions — search, start, stop, export.
 * Routes to the correct adapter based on device brand.
 */
export class PlaybackManager {
  private sessions = new Map<string, PlaybackSession>();
  private exportJobs = new Map<string, ExportJob>();
  private logger: pino.Logger;
  private deviceManager: DeviceManager;

  constructor(deviceManager: DeviceManager, logger: pino.Logger) {
    this.deviceManager = deviceManager;
    this.logger = logger.child({ service: 'playback-manager' });
  }

  async search(params: PlaybackSearchParams): Promise<PlaybackSegment[]> {
    const adapter = this.deviceManager.getAdapter(params.deviceId);
    if (!adapter) throw new Error(`Device ${params.deviceId} not connected`);

    this.logger.info({ deviceId: params.deviceId, channel: params.channel }, 'Playback search');
    return adapter.search(params);
  }

  async startPlayback(params: PlaybackStartParams): Promise<PlaybackSession> {
    const adapter = this.deviceManager.getAdapter(params.deviceId);
    if (!adapter) throw new Error(`Device ${params.deviceId} not connected`);

    const session = await adapter.startPlayback(params);
    this.sessions.set(session.sessionId, session);
    this.logger.info({ sessionId: session.sessionId, deviceId: params.deviceId }, 'Playback started');
    return session;
  }

  async stopPlayback(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const adapter = this.deviceManager.getAdapter(session.deviceId);
    if (adapter) {
      await adapter.stopPlayback(sessionId);
    }

    this.sessions.delete(sessionId);
    this.logger.info({ sessionId }, 'Playback stopped');
  }

  async exportClip(params: ClipExportParams): Promise<ExportJob> {
    const adapter = this.deviceManager.getAdapter(params.deviceId);
    if (!adapter) throw new Error(`Device ${params.deviceId} not connected`);

    const job = await adapter.exportClip(params);
    this.exportJobs.set(job.jobId, job);
    this.logger.info({ jobId: job.jobId, deviceId: params.deviceId }, 'Export job created');
    return job;
  }

  getSession(sessionId: string): PlaybackSession | undefined {
    return this.sessions.get(sessionId);
  }

  getExportJob(jobId: string): ExportJob | undefined {
    return this.exportJobs.get(jobId);
  }

  listSessions(): PlaybackSession[] {
    return Array.from(this.sessions.values());
  }
}
