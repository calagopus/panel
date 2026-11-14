import { z } from 'zod';
import { useUserSetting } from '@/lib/userSettings.ts';

const SERVER_SELECT_SHOW_OTHERS_KEY = 'server_select::show_others';

const serverSelectShowOthersSchema = z.boolean();

export function useServerSelectShowOthers() {
  return useUserSetting(SERVER_SELECT_SHOW_OTHERS_KEY, serverSelectShowOthersSchema, false);
}
