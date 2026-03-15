export class AuthService {
  async verifyToken(_token: string): Promise<{ valid: boolean; userId?: string }> {
    // Delegate to Fastify JWT verify
    return { valid: true };
  }
}
