import { ReactNode, useMemo } from 'react';
import { ContainerRegistry, makeComponentHookable } from 'shared';
import AppIcon from '@/elements/AppIcon.tsx';
import Copyright from '@/elements/Copyright.tsx';
import ContentContainer from '@/elements/containers/ContentContainer.tsx';
import ExtensionSlot from '@/elements/ExtensionSlot.tsx';
import { useGlobalStore } from '@/stores/global.ts';

export interface Props {
  title?: string;
  registry?: ContainerRegistry<Props>;
  children: ReactNode;
}

function AuthWrapper(props: Props) {
  const modifiedProps = useMemo(() => {
    let currentProps = props;

    if (props.registry) {
      for (const interceptor of props.registry.propsInterceptors) {
        currentProps = interceptor(currentProps);
      }
    }

    return currentProps;
  }, [props]);

  const { title, registry, children } = modifiedProps;

  const settings = useGlobalStore((state) => state.settings);
  const authRegistry = window.extensionContext.extensionRegistry.pages.auth;

  return (
    <ContentContainer title={settings.app.name}>
      <div className='flex items-center justify-center h-screen'>
        <div className='flex flex-col items-center justify-center h-full px-2 md:px-0 max-w-100 w-full'>
          <ExtensionSlot components={authRegistry.prependedComponents} name='auth-prepended' />
          <ExtensionSlot components={registry?.prependedComponents ?? []} name='prepended' props={modifiedProps} />

          <AppIcon className='mb-5 w-full sm:w-fit' />
          {title && <h1 className='text-3xl font-bold mb-4'>{title}</h1>}

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

          <Copyright className='mt-4 text-sm' />

          <ExtensionSlot components={authRegistry.appendedComponents} name='auth-appended' />
        </div>
      </div>
    </ContentContainer>
  );
}

export default makeComponentHookable(AuthWrapper);
