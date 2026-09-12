import { axiosInstance } from '@/api/axios.ts';
import { emailVariablesUrl } from './url.ts';

export default async (templateIdentifier: string | null, name: string): Promise<void> => {
  await axiosInstance.delete(`${emailVariablesUrl(templateIdentifier)}/${name}`);
};
