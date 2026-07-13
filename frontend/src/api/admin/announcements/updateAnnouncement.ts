import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { formExtensionSchemas, serializeForApi } from '@/lib/api-transform.ts';
import { adminAnnouncementUpdateSchema } from '@/lib/schemas/admin/announcements.ts';

export default async (
  announcementUuid: string,
  announcementData: z.infer<typeof adminAnnouncementUpdateSchema>,
): Promise<void> => {
  await axiosInstance.patch(
    `/api/admin/announcements/${announcementUuid}`,
    serializeForApi(
      adminAnnouncementUpdateSchema,
      announcementData,
      formExtensionSchemas('admin.announcements.createOrUpdate'),
    ),
  );
};
