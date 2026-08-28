import { axiosInstance } from '@/api/axios.ts';
import { UserSettingValue } from '@/lib/schemas/user/settings.ts';

export default async (settings: Record<string, UserSettingValue | null>): Promise<void> => {
  await axiosInstance.patch('/api/client/account/settings', { settings });
};

export function updateUserSettingsKeepalive(settings: Record<string, UserSettingValue | null>) {
  fetch('/api/client/account/settings', {
    method: 'PATCH',
    keepalive: true,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ settings }),
  }).catch(() => null);
}
