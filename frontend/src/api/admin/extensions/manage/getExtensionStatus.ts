import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminBackendExtensionSchema } from '@/lib/schemas/admin/backendExtension.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

const extensionBuildPhaseSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('preparing') }),
  z.object({ type: z.literal('clearing') }),
  z.object({ type: z.literal('adding'), done: z.number(), total: z.number() }),
  z.object({ type: z.literal('resync') }),
  z.object({ type: z.literal('staging_translations') }),
  z.object({ type: z.literal('building') }),
  z.object({ type: z.literal('verifying') }),
  z.object({ type: z.literal('installing') }),
  z.object({ type: z.literal('restarting') }),
]);

const extensionSupervisorStateSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('idle') }),
  z.object({ type: z.literal('queued') }),
  z.object({ type: z.literal('building'), phase: extensionBuildPhaseSchema }),
  z.object({ type: z.literal('succeeded') }),
  z.object({ type: z.literal('failed') }),
]);

const extensionSupervisorStatusSchema = z.object({
  state: extensionSupervisorStateSchema,
  panelVersion: z.string(),
  cacheKey: z.string(),
  binName: z.string(),
  buildId: z.number().nullable(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  exitCode: z.number().nullable(),
  failureReason: z.string().nullable(),
  logLen: z.number(),
});

const extensionStatusSchema = z.object({
  isBuilding: z.boolean(),
  supervisor: extensionSupervisorStatusSchema.nullable(),
  pendingExtensions: z.array(adminBackendExtensionSchema),
  removedExtensions: z.array(adminBackendExtensionSchema),
});

export type ExtensionSupervisorState = z.infer<typeof extensionSupervisorStateSchema>;
export type ExtensionStatus = z.infer<typeof extensionStatusSchema>;

export default async (): Promise<ExtensionStatus> => {
  const { data } = await axiosInstance.get('/api/admin/extensions/manage/status');
  return parseFromApi(extensionStatusSchema, data);
};
