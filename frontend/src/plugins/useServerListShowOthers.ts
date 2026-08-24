import { z } from 'zod';
import { useUserSetting } from '@/lib/userSettings.ts';

const SERVER_LIST_SHOW_OTHERS_KEY = 'dashboard::server_list_show_others';

const serverListShowOthersSchema = z.boolean();

export function useServerListShowOthers() {
  return useUserSetting(SERVER_LIST_SHOW_OTHERS_KEY, serverListShowOthersSchema, false);
}
