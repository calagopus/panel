import { z } from 'zod';

export const userSettingsMapSchema = z.record(z.string(), z.json());

export type UserSettingValue = z.infer<ReturnType<typeof z.json>>;
export type UserSettingsMap = z.infer<typeof userSettingsMapSchema>;
