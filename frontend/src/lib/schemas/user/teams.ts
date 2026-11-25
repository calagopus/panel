import { z } from 'zod';
import { userSchema } from '@/lib/schemas/user.ts';
import { nullableString } from '@/lib/serialization/transformers.ts';

export const userTeamMemberManagement = z.enum(['members', 'presets']);

export const userTeamPresetSchema = z.looseObject({
  uuid: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  weight: z.number(),
  permissions: z.array(z.string()),
  ignoredFiles: z.array(z.string()),
  created: z.coerce.date(),
});

export const userTeamMembershipSchema = z.object({
  preset: userTeamPresetSchema,
  management: z.array(userTeamMemberManagement),
  accepted: z.coerce.date().nullable(),
});

export const userTeamSchema = z.looseObject({
  uuid: z.string(),
  owner: z.lazy(() => userSchema),
  name: z.string(),
  description: z.string().nullable(),
  membership: userTeamMembershipSchema.nullable(),
  created: z.coerce.date(),
});

export const userTeamMemberSchema = z.looseObject({
  user: z.lazy(() => userSchema),
  preset: userTeamPresetSchema,
  management: z.array(userTeamMemberManagement),
  inviter: z.lazy(() => userSchema).nullable(),
  accepted: z.coerce.date().nullable(),
  created: z.coerce.date(),
});

export const userTeamUpdateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.preprocess(nullableString, z.string().max(1024).nullable()),
});

export const userTeamPresetUpdateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.preprocess(nullableString, z.string().max(1024).nullable()),
  weight: z.number().int().min(0).max(1_000_000),
  permissions: z.array(z.string()),
  ignoredFiles: z.array(z.string()),
});

export const userTeamMemberUpdateSchema = z.object({
  presetUuid: z.string().min(1),
  management: z.array(userTeamMemberManagement),
});

export const userTeamMemberCreateSchema = userTeamMemberUpdateSchema.extend({
  email: z.email(),
});

export const userTeamCountsSchema = z.record(
  z.string(),
  z.object({
    teamServers: z.number(),
    teamMembers: z.number(),
  }),
);
