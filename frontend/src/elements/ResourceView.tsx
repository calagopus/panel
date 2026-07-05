import type { ReactNode } from 'react';
import ScreenBlock from '@/elements/ScreenBlock.tsx';
import Spinner from '@/elements/Spinner.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

interface ResourceViewProps<T> {
  resource: {
    data: T | undefined;
    loading: boolean;
  };
  children: (data: T) => ReactNode;
}

export default function ResourceView<T>({ resource, children }: ResourceViewProps<T>) {
  const { t } = useTranslations();
  const { data, loading } = resource;

  if (data === undefined || data === null) {
    if (loading) {
      return <Spinner.Centered />;
    }

    return (
      <ScreenBlock
        title={t('elements.screenBlock.notFound.title', {})}
        content={t('elements.screenBlock.notFound.content', {})}
      />
    );
  }

  return <>{children(data)}</>;
}
