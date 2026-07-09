import { z } from 'zod';

export const userApiKeySchema = z.object({
  uuid: z.string(),
  name: z.string().min(3).max(31),
  keyStart: z.string(),
  allowedIps: z.array(z.ipv4().or(z.ipv6()).or(z.cidrv4()).or(z.cidrv6())),
  userPermissions: z.array(z.string()),
  serverPermissions: z.array(z.string()),
  adminPermissions: z.array(z.string()),
  expires: z.coerce.date().nullable().optional(),
  lastUsed: z.coerce.date(),
  created: z.coerce.date(),
});

export const userApiKeyUpdateSchema = z.lazy(() =>
  userApiKeySchema.omit({
    uuid: true,
    keyStart: true,
    lastUsed: true,
    created: true,
  }),
);
