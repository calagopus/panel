import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverSubuserSchema } from '@/lib/schemas/server/subusers.ts';

interface Data {
  email: string;
  permissions: string[];
  ignoredFiles: string[];
  captcha: string | null;
}

export default async (uuid: string, subuserData: Data): Promise<z.infer<typeof serverSubuserSchema>> => {
  const { data } = await axiosInstance.post(`/api/client/servers/${uuid}/subusers`, {
    email: subuserData.email,
    permissions: subuserData.permissions,
    ignored_files: subuserData.ignoredFiles,
    captcha: subuserData.captcha,
  });
  return data.subuser;
};
