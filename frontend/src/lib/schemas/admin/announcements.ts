import { z } from 'zod';
import { announcementType } from '../announcements.ts';

export const adminAnnouncementSchema = z.object({
  uuid: z.string(),
  type: z.lazy(() => announcementType),
  enabled: z.boolean(),
  enabledStart: z.coerce.date().nullable(),
  enabledEnd: z.coerce.date().nullable(),
  dismissible: z.boolean(),
  dismissibleEnd: z.coerce.date().nullable(),
  title: z.string().min(1).max(255),
  titleTranslations: z.record(z.string(), z.string()),
  content: z.string().min(1).max(2048),
  contentTranslations: z.record(z.string(), z.string()),
  locations: z.array(z.string()),
  nodes: z.array(z.string()),
  backupConfigurations: z.array(z.string()),
  eggs: z.array(z.string()),
  created: z.string(),
});

export const adminAnnouncementUpdateSchema = adminAnnouncementSchema.omit({ uuid: true, created: true });

export const adminAnnouncementCreateSchema = adminAnnouncementUpdateSchema;
