import { faSearch } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group, Text, Title, TitleOrder } from '@mantine/core';
import classNames from 'classnames';
import { Dispatch, ReactNode, SetStateAction } from 'react';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import TextInput from '../input/TextInput.tsx';
import { useNavbarPageHeader } from './useNavbarPageHeader.ts';

export interface ContentContainerHeaderProps {
  title: string;
  subtitle?: string;
  hideTitleComponent?: boolean;
  titleOrder?: TitleOrder;
  search?: string;
  setSearch?: Dispatch<SetStateAction<string>>;
  contentRight?: ReactNode;
  hoistToNavbar?: boolean;
}

export default function ContentContainerHeader({
  title,
  subtitle,
  hideTitleComponent,
  titleOrder,
  search,
  setSearch,
  contentRight,
  hoistToNavbar = false,
}: ContentContainerHeaderProps) {
  const { t } = useTranslations();
  const hoisted = useNavbarPageHeader({ title, subtitle }, hoistToNavbar && !hideTitleComponent);

  if (hideTitleComponent) return null;

  const titleBlock = (
    <div className={classNames({ 'hidden lg:block': hoisted })}>
      <Title order={titleOrder}>{title}</Title>
      {subtitle ? (
        <Text size='xs' c='dimmed'>
          {subtitle}
        </Text>
      ) : null}
    </div>
  );

  if (setSearch) {
    return (
      <Group justify='space-between' mb='md'>
        {titleBlock}
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
        {titleBlock}
        <Group>{contentRight}</Group>
      </Group>
    );
  }

  return (
    <div className={classNames('mb-4', { 'hidden lg:block': hoisted })}>
      <Title order={titleOrder}>{title}</Title>
      {subtitle ? (
        <Text size='xs' c='dimmed'>
          {subtitle}
        </Text>
      ) : null}
    </div>
  );
}
