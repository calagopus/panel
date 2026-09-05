import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

interface Props {
  loading: boolean;
  disabled?: boolean;
}

export default function SettingsSaveButton({ loading, disabled }: Props) {
  const { t } = useTranslations();

  return (
    <AdminCan action='settings.update' cantSave>
      <Button type='submit' disabled={disabled} loading={loading}>
        {t('common.button.save', {})}
      </Button>
    </AdminCan>
  );
}
