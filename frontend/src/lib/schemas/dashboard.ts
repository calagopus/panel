import { z } from 'zod';
import { nullableString } from '@/lib/transformers.ts';

export const dashboardAccountSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(15)
    .regex(/^[a-zA-Z0-9_]+$/),
  nameFirst: z.preprocess(nullableString, z.string().min(1).max(255).nullable()),
  nameLast: z.preprocess(nullableString, z.string().min(1).max(255).nullable()),
  language: z.string(),
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

export const dashboardEmailTwoFactorToggleSchema = z.object({
  password: z.string().max(512),
});

export const dashboardPasswordLoginSchema = z.object({
  password: z.string().max(512),
});
