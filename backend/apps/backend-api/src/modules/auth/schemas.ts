import { z } from 'zod';

export const verifyTokenSchema = z.object({ token: z.string().min(1) });
export const refreshTokenSchema = z.object({ refreshToken: z.string().min(1) });
