import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminAnnouncementCreateSchema, adminAnnouncementSchema } from '@/lib/schemas/admin/announcements.ts';
import { formExtensionSchemas, parseFromApi, serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (
  announcementData: z.infer<typeof adminAnnouncementCreateSchema>,
): Promise<z.infer<typeof adminAnnouncementSchema>> => {
  const { data } = await axiosInstance.post(
    '/api/admin/announcements',
    serializeForApi(
      adminAnnouncementCreateSchema,
      announcementData,
      formExtensionSchemas('admin.announcements.createOrUpdate'),
    ),
  );
  return parseFromApi(adminAnnouncementSchema, data.announcement);
};
