import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function BooleanText({ value }: { value: boolean }) {
  const { t } = useTranslations();

  return <>{t(value ? 'common.yes' : 'common.no', {})}</>;
}
