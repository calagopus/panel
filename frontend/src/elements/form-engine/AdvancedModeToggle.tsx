import Switch from '@/elements/input/Switch.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useAdvancedMode } from './useAdvancedMode.ts';

export function AdvancedModeToggle() {
  const { t } = useTranslations();
  const [advanced, setAdvanced] = useAdvancedMode();

  return (
    <Switch
      label={t('elements.formEngine.advancedMode', {})}
      checked={advanced}
      onChange={(e) => setAdvanced(e.currentTarget.checked)}
    />
  );
}
