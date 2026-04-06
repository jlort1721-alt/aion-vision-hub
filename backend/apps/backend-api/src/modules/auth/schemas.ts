import { z } from 'zod';

// Local auth schemas
// SECURITY: Registration uses strong password policy
export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string()
    .min(12, 'La contraseña debe tener al menos 12 caracteres')
    .max(128)
    .regex(/[A-Z]/, 'Requiere al menos una mayúscula')
    .regex(/[a-z]/, 'Requiere al menos una minúscula')
    .regex(/[0-9]/, 'Requiere al menos un número')
    .regex(/[^A-Za-z0-9]/, 'Requiere al menos un carácter especial'),
  fullName: z.string().min(2),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const verifyTokenSchema = z.object({ token: z.string().min(1) });
export const refreshTokenSchema = z.object({ refreshToken: z.string().min(1, 'refreshToken is required') });

// Password policy — min 12 chars, complexity requirements
export const PasswordSchema = z.string()
  .min(12, 'La contraseña debe tener al menos 12 caracteres')
  .max(128, 'La contraseña no puede exceder 128 caracteres')
  .regex(/[A-Z]/, 'Debe contener al menos una letra mayúscula')
  .regex(/[a-z]/, 'Debe contener al menos una letra minúscula')
  .regex(/[0-9]/, 'Debe contener al menos un número')
  .regex(/[^A-Za-z0-9]/, 'Debe contener al menos un carácter especial');

export const resetPasswordRequestSchema = z.object({
  email: z.string().email('Email inválido'),
});

export const resetPasswordConfirmSchema = z.object({
  token: z.string().min(1, 'Token requerido'),
  newPassword: PasswordSchema,
});

export const approveUserParamsSchema = z.object({ id: z.string().uuid() });
export const userStatusSchema = z.enum(['pending_approval', 'active', 'suspended', 'disabled']);
