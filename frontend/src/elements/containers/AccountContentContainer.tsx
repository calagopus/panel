import { TitleOrder } from '@mantine/core';
import { Dispatch, ReactNode, SetStateAction, useMemo } from 'react';
import { ContainerRegistry, makeComponentHookable } from 'shared';
import { useCurrentWindow } from '@/providers/CurrentWindowProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import ExtensionSlot from '../ExtensionSlot.tsx';
import ContentContainer from './ContentContainer.tsx';
import ContentContainerHeader from './ContentContainerHeader.tsx';

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

function AccountContentContainer(props: Props) {
  const modifiedProps = useMemo(() => {
    let currentProps = props;

    if (props.registry) {
      for (const interceptor of props.registry.propsInterceptors) {
        currentProps = interceptor(currentProps);
      }
    }

    return currentProps;
  }, [props]);

  const {
    title,
    subtitle,
    hideTitleComponent,
    titleOrder,
    search,
    setSearch,
    contentRight,
    registry,
    fullscreen = false,
    children,
  } = modifiedProps;

  const settings = useGlobalStore((state) => state.settings);
  const { id } = useCurrentWindow();

  return (
    <ContentContainer title={`${title} | ${settings.app.name}`}>
      <div className={`${fullscreen || id ? 'mb-4' : 'px-4 lg:px-6 mb-4 lg:mt-6 mt-2'}`}>
        <ExtensionSlot components={registry?.prependedComponents ?? []} name='prepended' props={modifiedProps} />

        <ContentContainerHeader
          title={title}
          subtitle={subtitle}
          hideTitleComponent={hideTitleComponent}
          titleOrder={titleOrder}
          search={search}
          setSearch={setSearch}
          contentRight={contentRight}
        />
        <ExtensionSlot
          components={registry?.prependedContentComponents ?? []}
          name='prepended-content'
          props={modifiedProps}
        />

        {children}

        <ExtensionSlot
          components={registry?.appendedContentComponents ?? []}
          name='appended-content'
          props={modifiedProps}
        />
      </div>
    </ContentContainer>
  );
}

export default makeComponentHookable(AccountContentContainer);
