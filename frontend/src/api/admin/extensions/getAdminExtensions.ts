import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminBackendExtensionSchema } from '@/lib/schemas/admin/backendExtension.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export interface AdminExtensionList {
  extensions: z.infer<typeof adminBackendExtensionSchema>[];
  disabled: string[];
  pendingDisabled: string[];
}

export default async (): Promise<AdminExtensionList> => {
  const { data } = await axiosInstance.get('/api/admin/extensions');
  return {
    extensions: data.extensions.map((item: unknown) => parseFromApi(adminBackendExtensionSchema, item)),
    disabled: data.disabled,
    pendingDisabled: data.pending_disabled,
  };
};
