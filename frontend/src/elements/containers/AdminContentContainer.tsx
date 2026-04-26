import { Group, Title, TitleOrder } from '@mantine/core';
import { Dispatch, ReactNode, SetStateAction, useMemo } from 'react';
import { ContainerRegistry, makeComponentHookable } from 'shared';
import { useCurrentWindow } from '@/providers/CurrentWindowProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import TextInput from '../input/TextInput.tsx';
import ContentContainer from './ContentContainer.tsx';

export interface Props {
  title: string;
  subtitle?: string;
  hideTitleComponent?: boolean;
  titleOrder?: TitleOrder;
  search?: string;
  setSearch?: Dispatch<SetStateAction<string>>;
  contentRight?: ReactNode;
  registry?: ContainerRegistry<Props>;
  fullscreen?: boolean;
  children: ReactNode;
}

function AdminContentContainer(props: Props) {
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
    subtitle,
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
            <div>
              <Title order={titleOrder} c='white'>
                {title}
              </Title>
              {subtitle ? <p className='text-xs text-gray-300!'>{subtitle}</p> : null}
            </div>
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
            <div>
              <Title order={titleOrder} c='white'>
                {title}
              </Title>
              {subtitle ? <p className='text-xs text-gray-300!'>{subtitle}</p> : null}
            </div>
            <Group>{contentRight}</Group>
          </Group>
        ) : (
          <div className='mb-4'>
            <Title order={titleOrder} c='white'>
              {title}
            </Title>
            {subtitle ? <p className='text-xs text-gray-300!'>{subtitle}</p> : null}
          </div>
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

export default makeComponentHookable(AdminContentContainer);
