import { z } from 'zod';
import { userSchema } from '@/lib/schemas/user.ts';

export const serverSubuserSchema = z.object({
  user: z.lazy(() => userSchema),
  permissions: z.array(z.string()),
  ignoredFiles: z.array(z.string()),
  created: z.date(),
});

export const serverSubuserCreateSchema = z.object({
  email: z.email(),
  permissions: z.array(z.string()),
  ignoredFiles: z.array(z.string()),
});

export const serverSubuserUpdateSchema = z.object({
  permissions: z.array(z.string()),
  ignoredFiles: z.array(z.string()),
});
