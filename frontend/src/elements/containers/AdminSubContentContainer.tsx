import { Group, Title, TitleOrder } from '@mantine/core';
import { Dispatch, ReactNode, SetStateAction, useMemo } from 'react';
import { ContainerRegistry, makeComponentHookable } from 'shared';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import TextInput from '../input/TextInput.tsx';
import ContentContainer from './ContentContainer.tsx';

export type Props<P = {}> = {
  title: string;
  hideTitleComponent?: boolean;
  titleOrder?: TitleOrder;
  search?: string;
  setSearch?: Dispatch<SetStateAction<string>>;
  contentRight?: ReactNode;
  children: ReactNode;
} & ({ registry: ContainerRegistry<Props<P>>; registryProps: P } | { registry?: never; registryProps?: never });

function AdminSubContentContainer<P>(props: Props<P>) {
  props = useMemo(() => {
    let modifiedProps = props;

    if (props.registry) {
      for (const interceptor of props.registry.propsInterceptors) {
        modifiedProps = interceptor(modifiedProps);
      }
    }

    return modifiedProps;
  }, [props]);

  const {
    title,
    hideTitleComponent = false,
    titleOrder = 1,
    search,
    setSearch,
    contentRight,
    registry,
    registryProps,
    children,
  } = props;

  const { t } = useTranslations();
  const { settings } = useGlobalStore();

  return (
    <ContentContainer title={`${title} | ${settings.app.name}`}>
      {registry?.prependedComponents.map((Component, index) => (
        <Component key={`prepended-sub-${index}`} {...props} {...registryProps} />
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
        <Component key={`prepended-sub-content-${index}`} {...props} {...registryProps} />
      ))}

      {children}

      {registry?.appendedContentComponents.map((Component, index) => (
        <Component key={`appended-sub-content-${index}`} {...props} {...registryProps} />
      ))}
    </ContentContainer>
  );
}

export default makeComponentHookable(AdminSubContentContainer) as typeof AdminSubContentContainer;
