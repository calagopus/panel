import { z } from 'zod';
import { adminFullUserSchema } from '@/lib/schemas/admin/users.ts';
import {
  userTeamMemberManagement,
  userTeamMembershipSchema,
  userTeamMemberUpdateSchema,
  userTeamPresetSchema,
  userTeamUpdateSchema,
} from '@/lib/schemas/user/teams.ts';

export const adminTeamSchema = z.looseObject({
  uuid: z.string(),
  owner: adminFullUserSchema,
  name: z.string(),
  description: z.string().nullable(),
  membership: userTeamMembershipSchema.nullable(),
  created: z.coerce.date(),
});

export const adminTeamMemberSchema = z.looseObject({
  user: adminFullUserSchema,
  preset: userTeamPresetSchema,
  management: z.array(userTeamMemberManagement),
  inviter: adminFullUserSchema.nullable(),
  accepted: z.coerce.date().nullable(),
  created: z.coerce.date(),
});

export const adminTeamCountsSchema = z.record(
  z.string(),
  z.object({
    teamServers: z.number(),
    teamMembers: z.number(),
  }),
);

export const adminTeamCreateSchema = userTeamUpdateSchema.extend({
  ownerUuid: z.string().min(1),
});

export const adminTeamMemberCreateSchema = userTeamMemberUpdateSchema.extend({
  userUuid: z.string().min(1),
});
