import { z } from 'zod';

export const adminBackendExtensionSchema = z.object({
  metadataToml: z.object({
    packageName: z.string(),
    name: z.string(),
    panelVersion: z.string(),
    licenseText: z.string().nullable(),
  }),
  description: z.string(),
  authors: z.array(z.string()),
  version: z.string(),
});
