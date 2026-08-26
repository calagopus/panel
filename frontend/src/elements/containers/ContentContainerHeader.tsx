import { faSearch } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group, Text, Title, TitleOrder } from '@mantine/core';
import { Dispatch, ReactNode, SetStateAction } from 'react';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import TextInput from '../input/TextInput.tsx';

export interface ContentContainerHeaderProps {
  title: string;
  subtitle?: string;
  hideTitleComponent?: boolean;
  titleOrder?: TitleOrder;
  search?: string;
  setSearch?: Dispatch<SetStateAction<string>>;
  contentRight?: ReactNode;
}

export default function ContentContainerHeader({
  title,
  subtitle,
  hideTitleComponent,
  titleOrder,
  search,
  setSearch,
  contentRight,
}: ContentContainerHeaderProps) {
  const { t } = useTranslations();

  if (hideTitleComponent) return null;

  if (setSearch) {
    return (
      <Group justify='space-between' mb='md'>
        <div>
          <Title order={titleOrder}>{title}</Title>
          {subtitle ? (
            <Text size='xs' c='dimmed'>
              {subtitle}
            </Text>
          ) : null}
        </div>
        <Group>
          <TextInput
            placeholder={t('common.input.search', {})}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftSection={<FontAwesomeIcon icon={faSearch} />}
            w={250}
          />
          {contentRight}
        </Group>
      </Group>
    );
  }

  if (contentRight) {
    return (
      <Group justify='space-between' mb='md'>
        <div>
          <Title order={titleOrder}>{title}</Title>
          {subtitle ? (
            <Text size='xs' c='dimmed'>
              {subtitle}
            </Text>
          ) : null}
        </div>
        <Group>{contentRight}</Group>
      </Group>
    );
  }

  return (
    <div className='mb-4'>
      <Title order={titleOrder}>{title}</Title>
      {subtitle ? (
        <Text size='xs' c='dimmed'>
          {subtitle}
        </Text>
      ) : null}
    </div>
  );
}
