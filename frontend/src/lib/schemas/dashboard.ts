import { z } from 'zod';

export const dashboardAccountSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(15)
    .regex(/^[a-zA-Z0-9_]+$/),
  nameFirst: z.string().min(1).max(255),
  nameLast: z.string().min(1).max(255),
  language: z.string(),
  toastPosition: z.enum(['top_left', 'top_center', 'top_right', 'bottom_left', 'bottom_center', 'bottom_right']),
  startOnGroupedServers: z.boolean(),
});

export const dashboardEmailSchema = z.object({
  email: z.email(),
  password: z.string().max(512),
});

export const dashboardPasswordSchema = z
  .object({
    currentPassword: z.string().max(512),
    newPassword: z.string().min(8).max(512),
    confirmNewPassword: z.string().min(8).max(512),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'Passwords do not match',
    path: ['confirmNewPassword'],
  });

export const dashboardTwoFactorEnableSchema = z.object({
  code: z.string().min(6).max(6),
  password: z.string().max(512),
});

export const dashboardTwoFactorDisableSchema = z.object({
  code: z.string().min(6).max(10),
  password: z.string().max(512),
});
