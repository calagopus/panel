import { z } from 'zod';

export const authForgotPasswordSchema = z.object({
  email: z.email(),
});

export const authRegisterSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(15)
    .regex(/^[a-zA-Z0-9_]+$/),
  email: z.email(),
  nameFirst: z.string().min(1).max(255),
  nameLast: z.string().min(1).max(255),
  password: z.string().min(8).max(512),
});

export const authResetPasswordSchema = z
  .object({
    password: z.string().min(8).max(512),
    confirmPassword: z.string().min(8).max(512),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const authUsernameSchema = z.object({
  username: z.string().nonempty(),
});

export const authPasswordSchema = z.object({
  password: z.string().max(512),
});

export const authTotpSchema = z.object({
  code: z.string().min(6).max(10),
});
