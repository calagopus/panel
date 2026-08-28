import { userToastPosition } from '@/lib/schemas/user.ts';
import { useUserSetting } from '@/lib/userSettings.ts';

export const TOAST_POSITION_KEY = 'app::toast_position';

export function useToastPosition() {
  return useUserSetting(TOAST_POSITION_KEY, userToastPosition, 'bottom_right');
}
