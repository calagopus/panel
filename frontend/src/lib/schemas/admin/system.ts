import { z } from 'zod';
import { adminNodeSchema } from './nodes.ts';

export const adminExtensionUpdateCheckResultNoUpdateSchema = z.object({
  type: z.literal('no_update'),
});

export const adminExtensionUpdateCheckResultUpdateAvailableSchema = z.object({
  type: z.literal('update_available'),
  version: z.string(),
  latestVersion: z.string(),
  changes: z.string().array(),
});

export const adminExtensionUpdateCheckResultErrorSchema = z.object({
  type: z.literal('error'),
  error: z.string(),
});

export const adminExtensionUpdateCheckResultSchema = z.discriminatedUnion('type', [
  adminExtensionUpdateCheckResultNoUpdateSchema,
  adminExtensionUpdateCheckResultUpdateAvailableSchema,
  adminExtensionUpdateCheckResultErrorSchema,
]);

export const adminUpdateHistoryEntrySchema = z.object({
  version: z.string(),
  timestamp: z.string(),
});

export const adminUpdateHistorySchema = z.object({
  panel: adminUpdateHistoryEntrySchema.array(),
  extensions: z.record(z.string(), adminUpdateHistoryEntrySchema.array()),
});

export const adminUpdateInformationSchema = z.object({
  panelVersion: z.string(),
  latestPanelVersion: z.string(),
  latestWingsVersion: z.string(),
  extensions: z.record(z.string(), adminExtensionUpdateCheckResultSchema),
});

export const adminNodeUpdateInformationSchema = z.object({
  version: z.string(),
  node: z.lazy(() => adminNodeSchema),
});

export const adminNodeDesyncSchema = z.object({
  localTime: z.string(),
  panelLocalTime: z.string(),
  node: z.lazy(() => adminNodeSchema),
});
