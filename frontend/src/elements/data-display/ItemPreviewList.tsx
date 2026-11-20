import classNames from 'classnames';
import { Fragment, ReactNode } from 'react';
import ScrollArea from '@/elements/layout/ScrollArea.tsx';
import Text from '@/elements/typography/Text.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export function ItemPreviewRow({
  icon,
  name,
  description,
  meta,
}: {
  icon?: ReactNode;
  name: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <div className='flex items-center gap-3 px-3 py-1.5 border-b border-(--mantine-color-default-border) last:border-b-0'>
      {icon && <span className='shrink-0 w-4 flex justify-center text-(--mantine-color-dimmed)'>{icon}</span>}
      <div className='flex flex-col min-w-0 grow'>
        <Text size='sm' truncate>
          {name}
        </Text>
        {description && (
          <Text size='xs' c='dimmed' truncate>
            {description}
          </Text>
        )}
      </div>
      {meta && <div className='shrink-0 text-sm text-(--mantine-color-dimmed) text-nowrap'>{meta}</div>}
    </div>
  );
}

export default function ItemPreviewList<T>({
  items,
  getKey,
  renderItem,
  mah = 240,
  limit = 100,
  className,
}: {
  items: T[];
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  mah?: number;
  limit?: number;
  className?: string;
}) {
  const { t } = useTranslations();

  if (items.length === 0) {
    return null;
  }

  return (
    <ScrollArea
      mah={mah}
      type='auto'
      className={classNames('rounded-sm border border-(--mantine-color-default-border)', className)}
    >
      {items.slice(0, limit).map((item) => (
        <Fragment key={getKey(item)}>{renderItem(item)}</Fragment>
      ))}
      {items.length > limit && (
        <Text size='xs' c='dimmed' className='px-3 py-1.5'>
          {t('common.moreItems', { count: items.length - limit })}
        </Text>
      )}
    </ScrollArea>
  );
}
