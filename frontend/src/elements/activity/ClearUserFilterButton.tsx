import { faX } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Button from '@/elements/buttons/Button.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function ClearUserFilterButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslations();

  return (
    <Button onClick={onClick} color='gray' leftSection={<FontAwesomeIcon icon={faX} />}>
      {t('common.button.clearUserFilter', {})}
    </Button>
  );
}
