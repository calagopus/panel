import { z } from 'zod';
import Checkbox from '@/elements/input/Checkbox.tsx';
import UserSettingScopeMenu from '@/elements/UserSettingScopeMenu.tsx';
import { useUserSetting } from '@/lib/userSettings.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export const NORMALIZE_CPU_LOAD_KEY = 'console::normalize_cpu_load';
export const normalizeCpuLoadSchema = z.boolean();

export default function CpuLoadSettings() {
  const { t } = useTranslations();
  const [doNormalizeCpuLoad, setDoNormalizeCpuLoad] = useUserSetting(
    NORMALIZE_CPU_LOAD_KEY,
    normalizeCpuLoadSchema,
    false,
  );

  return (
    <Checkbox
      label={
        <span className='inline-flex items-center gap-1'>
          {t('pages.server.console.details.normalizeCpuLoad', {})}
          <UserSettingScopeMenu settingKey={NORMALIZE_CPU_LOAD_KEY} value={doNormalizeCpuLoad} withinPortal={false} />
        </span>
      }
      checked={doNormalizeCpuLoad}
      onChange={(e) => setDoNormalizeCpuLoad(e.target.checked)}
    />
  );
}
