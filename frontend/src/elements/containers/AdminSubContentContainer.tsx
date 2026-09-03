import { TitleOrder } from '@mantine/core';
import { Dispatch, ReactNode, SetStateAction, useMemo } from 'react';
import { ContainerRegistry, makeComponentHookable } from 'shared';
import { useGlobalStore } from '@/stores/global.ts';
import ExtensionSlot from '../ExtensionSlot.tsx';
import ContentContainer from './ContentContainer.tsx';
import ContentContainerHeader from './ContentContainerHeader.tsx';

export type Props<P = {}> = {
  title: string;
  subtitle?: string;
  hideTitleComponent?: boolean;
  titleOrder?: TitleOrder;
  search?: string;
  setSearch?: Dispatch<SetStateAction<string>>;
  contentRight?: ReactNode;
  children: ReactNode;
} & ({ registry: ContainerRegistry<Props<P>, P>; registryProps: P } | { registry?: never; registryProps?: never });

function AdminSubContentContainer<P>(props: Props<P>) {
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
    hideTitleComponent = false,
    titleOrder = 1,
    search,
    setSearch,
    contentRight,
    registry,
    registryProps,
    children,
  } = modifiedProps;

  const settings = useGlobalStore((state) => state.settings);

  return (
    <ContentContainer title={`${title} | ${settings.app.name}`}>
      <ExtensionSlot
        components={registry?.prependedComponents ?? []}
        name='prepended-sub'
        props={{ ...modifiedProps, ...registryProps }}
      />

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
        name='prepended-sub-content'
        props={{ ...modifiedProps, ...registryProps }}
      />

      {children}

      <ExtensionSlot
        components={registry?.appendedContentComponents ?? []}
        name='appended-sub-content'
        props={{ ...modifiedProps, ...registryProps }}
      />
    </ContentContainer>
  );
}

export default makeComponentHookable(AdminSubContentContainer) as typeof AdminSubContentContainer;
