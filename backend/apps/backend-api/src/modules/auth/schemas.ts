import { z } from 'zod';

// Local auth schemas
export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Legacy schema kept for backward compat (Supabase token exchange)
export const supabaseLoginSchema = z.object({ supabaseToken: z.string().min(1, 'supabaseToken is required') });

export const verifyTokenSchema = z.object({ token: z.string().min(1) });
export const refreshTokenSchema = z.object({ refreshToken: z.string().min(1, 'refreshToken is required') });
