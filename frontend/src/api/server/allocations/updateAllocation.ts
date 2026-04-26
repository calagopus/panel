import { axiosInstance } from '@/api/axios.ts';

interface Data {
  notes?: string | null;
  primary?: boolean;
}

export default async (uuid: string, allocationUuid: string, data: Data): Promise<void> => {
  await axiosInstance.patch(`/api/client/servers/${uuid}/allocations/${allocationUuid}`, {
    notes: data.notes,
    primary: data.primary,
  });
};
