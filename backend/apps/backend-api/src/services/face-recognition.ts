/**
 * Face Recognition Service -- Framework for face detection and matching
 * Supports: Hikvision native face DB, CodeProject.AI, or DeepStack
 * Activates when FACE_RECOGNITION_URL is configured
 */
import { createLogger } from '@aion/common-utils';

const logger = createLogger({ name: 'face-recognition' });

export class FaceRecognitionService {
  private apiUrl: string;
  private provider: string;

  constructor() {
    this.apiUrl = process.env.FACE_RECOGNITION_URL || '';
    this.provider = process.env.FACE_RECOGNITION_PROVIDER || 'none';
  }

  isConfigured(): boolean {
    return !!this.apiUrl;
  }

  async detectFaces(imageBuffer: Buffer): Promise<Record<string, unknown>[]> {
    if (!this.isConfigured()) return [];
    try {
      const formData = new FormData();
      formData.append('image', new Blob([new Uint8Array(imageBuffer)]), 'frame.jpg');
      const resp = await fetch(`${this.apiUrl}/v1/vision/face`, { method: 'POST', body: formData });
      const data = await resp.json() as Record<string, unknown>;
      return (data.predictions || []) as Record<string, unknown>[];
    } catch (err) {
      logger.error({ error: (err as Error).message }, 'Face detection failed');
      return [];
    }
  }

  async recognizeFace(imageBuffer: Buffer): Promise<Record<string, unknown> | null> {
    if (!this.isConfigured()) return null;
    try {
      const formData = new FormData();
      formData.append('image', new Blob([new Uint8Array(imageBuffer)]), 'frame.jpg');
      const resp = await fetch(`${this.apiUrl}/v1/vision/face/recognize`, { method: 'POST', body: formData });
      return await resp.json() as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  async registerFace(personId: string, name: string, imageBuffer: Buffer): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      const formData = new FormData();
      formData.append('image', new Blob([new Uint8Array(imageBuffer)]), 'face.jpg');
      formData.append('userid', personId);
      formData.append('name', name);
      const resp = await fetch(`${this.apiUrl}/v1/vision/face/register`, { method: 'POST', body: formData });
      return (await resp.json() as Record<string, unknown>).success === true;
    } catch {
      return false;
    }
  }

  getStatus(): Record<string, unknown> {
    return {
      configured: this.isConfigured(),
      provider: this.provider,
      message: this.isConfigured()
        ? `Face recognition via ${this.provider}`
        : 'Set FACE_RECOGNITION_URL and FACE_RECOGNITION_PROVIDER (codeproject_ai, deepstack, or frigate)',
    };
  }
}

export const faceRecognition = new FaceRecognitionService();
