import { axiosInstance } from '@/api/axios.ts';

interface GeneralHealthResponse {
  localTime: string;
  ntpOffsets: Record<
    string,
    {
      offsetMicros: number;
    }
  >;
  migrations: {
    total: number;
    applied: number;
    extensions: Record<
      string,
      {
        total: number;
        applied: number;
      }
    >;
  };
}

export default async (): Promise<GeneralHealthResponse> => {
  const { data } = await axiosInstance.get('/api/admin/system/health/general');
  return data;
};
