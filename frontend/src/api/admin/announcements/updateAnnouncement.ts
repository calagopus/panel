import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminAnnouncementUpdateSchema } from '@/lib/schemas/admin/announcements.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

export default async (
  announcementUuid: string,
  announcementData: z.infer<typeof adminAnnouncementUpdateSchema>,
): Promise<void> => {
  await axiosInstance.patch(`/api/admin/announcements/${announcementUuid}`, {
    ...transformKeysToSnakeCase(announcementData),
    enabled_start: announcementData.enabledStart ? announcementData.enabledStart.toISOString() : null,
    enabled_end: announcementData.enabledEnd ? announcementData.enabledEnd.toISOString() : null,
    dismissible_end: announcementData.dismissibleEnd ? announcementData.dismissibleEnd.toISOString() : null,
  });
};
