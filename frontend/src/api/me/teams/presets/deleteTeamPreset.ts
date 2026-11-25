import { axiosInstance } from '@/api/axios.ts';

export default async (teamUuid: string, presetUuid: string, replacementPresetUuid: string | null): Promise<void> => {
  await axiosInstance.delete(`/api/client/teams/${teamUuid}/presets/${presetUuid}`, {
    data: { replacement_preset_uuid: replacementPresetUuid },
  });
};
