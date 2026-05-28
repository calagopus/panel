import { z } from 'zod';

export const announcementType = z.enum(['info', 'success', 'warning', 'error']);

export const announcementSchema = z.object({
  uuid: z.string(),
  type: announcementType,
  dismissible: z.boolean(),
  dismissibleEnd: z.string().nullable(),
  title: z.string(),
  titleTranslations: z.record(z.string(), z.string()),
  content: z.string(),
  contentTranslations: z.record(z.string(), z.string()),
});
