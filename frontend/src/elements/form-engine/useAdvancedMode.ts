import { z } from 'zod';
import { useUserSetting } from '@/lib/userSettings.ts';

const advancedModeSchema = z.boolean();

export function useAdvancedMode(): [boolean, (value: boolean) => void] {
  return useUserSetting('form_engine::advanced_mode', advancedModeSchema, false);
}
