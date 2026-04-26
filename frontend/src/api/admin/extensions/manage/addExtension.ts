import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminBackendExtensionSchema } from '@/lib/schemas/admin/backendExtension.ts';

export default async (extension: File): Promise<z.infer<typeof adminBackendExtensionSchema>> => {
  const { data } = await axiosInstance.put('/api/admin/extensions/manage/add', extension, {
    headers: {
      'Content-Type': 'application/zip',
    },
  });
  return data.extension;
};
