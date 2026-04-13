import { Group, Title, TitleOrder } from '@mantine/core';
import { Dispatch, ReactNode, SetStateAction } from 'react';
import { ContainerRegistry } from 'shared';
import { useCurrentWindow } from '@/providers/CurrentWindowProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import TextInput from '../input/TextInput.tsx';
import ContentContainer from './ContentContainer.tsx';

export interface Props {
  title: string;
  hideTitleComponent?: boolean;
  titleOrder?: TitleOrder;
  search?: string;
  setSearch?: Dispatch<SetStateAction<string>>;
  contentRight?: ReactNode;
  registry?: ContainerRegistry<Props>;
  fullscreen?: boolean;
  children: ReactNode;
}

export default function AdminContentContainer(props: Props) {
  const {
    title,
    hideTitleComponent = false,
    titleOrder = 1,
    search,
    setSearch,
    contentRight,
    registry,
    fullscreen = false,
    children,
  } = props;

  const { t } = useTranslations();
  const { settings } = useGlobalStore();
  const { id } = useCurrentWindow();

  return (
    <ContentContainer title={`${title} | ${settings.app.name}`}>
      <div className={`${fullscreen || id ? 'mb-4' : 'px-4 lg:px-6 mb-4 lg:mt-6'}`}>
        {registry?.prependedComponents.map((Component, index) => (
          <Component key={`prepended-${index}`} {...props} />
        ))}

        {hideTitleComponent ? null : setSearch ? (
          <Group justify='space-between' mb='md'>
            <Title order={titleOrder} c='white'>
              {title}
            </Title>
            <Group>
              <TextInput
                placeholder={t('common.input.search', {})}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                w={250}
              />
              {contentRight}
            </Group>
          </Group>
        ) : contentRight ? (
          <Group justify='space-between' mb='md'>
            <Title order={titleOrder} c='white'>
              {title}
            </Title>
            <Group>{contentRight}</Group>
          </Group>
        ) : (
          <Title order={titleOrder} c='white'>
            {title}
          </Title>
        )}
        {registry?.prependedContentComponents.map((Component, index) => (
          <Component key={`prepended-content-${index}`} {...props} />
        ))}

        {children}

        {registry?.appendedContentComponents.map((Component, index) => (
          <Component key={`appended-content-${index}`} {...props} />
        ))}
      </div>
    </ContentContainer>
  );
}
