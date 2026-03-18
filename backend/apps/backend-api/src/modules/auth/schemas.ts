import { z } from 'zod';

export const loginSchema = z.object({ supabaseToken: z.string().min(1, 'supabaseToken is required') });
export const verifyTokenSchema = z.object({ token: z.string().min(1) });
export const refreshTokenSchema = z.object({ refreshToken: z.string().min(1, 'refreshToken is required') });
