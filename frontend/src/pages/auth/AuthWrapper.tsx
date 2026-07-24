import { ReactNode, useMemo } from 'react';
import { ContainerRegistry, makeComponentHookable } from 'shared';
import AppIcon from '@/elements/AppIcon.tsx';
import Copyright from '@/elements/Copyright.tsx';
import ContentContainer from '@/elements/containers/ContentContainer.tsx';
import { useGlobalStore } from '@/stores/global.ts';

export interface Props {
  title?: string;
  registry?: ContainerRegistry<Props>;
  children: ReactNode;
}

function AuthWrapper(props: Props) {
  props = useMemo(() => {
    let modifiedProps = props;

    if (props.registry) {
      for (const interceptor of props.registry.propsInterceptors) {
        modifiedProps = interceptor(modifiedProps);
      }
    }

    return modifiedProps;
  }, [props]);

  const { title, registry, children } = props;

  const settings = useGlobalStore((state) => state.settings);
  const authRegistry = window.extensionContext.extensionRegistry.pages.auth;

  return (
    <ContentContainer title={settings.app.name}>
      <div className='flex items-center justify-center h-screen'>
        <div className='flex flex-col items-center justify-center h-full px-2 md:px-0 max-w-100 w-full'>
          {authRegistry.prependedComponents.map((Component, index) => (
            <Component key={`auth-prepended-${index}`} />
          ))}
          {registry?.prependedComponents.map((Component, index) => (
            <Component key={`prepended-${index}`} {...props} />
          ))}

          <AppIcon className='mb-5 w-full sm:w-fit' />
          {title && <h1 className='text-3xl font-bold mb-4'>{title}</h1>}

          {registry?.prependedContentComponents.map((Component, index) => (
            <Component key={`prepended-content-${index}`} {...props} />
          ))}

          {children}

          {registry?.appendedContentComponents.map((Component, index) => (
            <Component key={`appended-content-${index}`} {...props} />
          ))}

          <Copyright className='mt-4 text-sm' />

          {authRegistry.appendedComponents.map((Component, index) => (
            <Component key={`auth-appended-${index}`} />
          ))}
        </div>
      </div>
    </ContentContainer>
  );
}

export default makeComponentHookable(AuthWrapper);
