import { AxiosRequestConfig } from 'axios';
import { axiosInstance } from '@/api/axios.ts';

export default async (form: FormData, config: AxiosRequestConfig, directory = ''): Promise<unknown> =>
  axiosInstance.putForm('/api/admin/assets', form, { ...config, params: { directory } });
