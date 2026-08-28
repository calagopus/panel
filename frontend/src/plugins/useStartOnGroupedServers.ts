import { z } from 'zod';
import { useUserSetting } from '@/lib/userSettings.ts';

export const START_ON_GROUPED_SERVERS_KEY = 'dashboard::start_on_grouped_servers';

const startOnGroupedServersSchema = z.boolean();

export function useStartOnGroupedServers() {
  return useUserSetting(START_ON_GROUPED_SERVERS_KEY, startOnGroupedServersSchema, false);
}
