import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminBackendExtensionSchema } from '@/lib/schemas/admin/backendExtension.ts';

export default async (
  extension: File,
  acceptLicense = false,
): Promise<{
  extension: z.infer<typeof adminBackendExtensionSchema>;
  needsLicenseAcceptance: boolean;
}> => {
  const { data } = await axiosInstance.put('/api/admin/extensions/manage/add', extension, {
    headers: {
      'Content-Type': 'application/zip',
    },
    params: acceptLicense ? { accept_license: true } : undefined,
  });
  return {
    extension: data.extension,
    needsLicenseAcceptance: data.needs_license_acceptance,
  };
};
