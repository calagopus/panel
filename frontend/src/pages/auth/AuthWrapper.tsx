import { faGlobe } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ReactNode, useMemo, useRef } from 'react';
import { ContainerRegistry, makeComponentHookable } from 'shared';
import AppIcon from '@/elements/AppIcon.tsx';
import ContentContainer from '@/elements/containers/ContentContainer.tsx';
import Copyright from '@/elements/Copyright.tsx';
import ExtensionSlot from '@/elements/ExtensionSlot.tsx';
import Select from '@/elements/input/Select.tsx';
import { useContainerAutoHeight } from '@/plugins/viewport/useContainerAutoHeight.ts';
import { useCurrentWindow } from '@/providers/CurrentWindowProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
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

  const { t, language, setLanguage } = useTranslations();
  const settings = useGlobalStore((state) => state.settings);
  const languages = useGlobalStore((state) => state.languages);
  const authRegistry = window.extensionContext.extensionRegistry.pages.auth;
  const containerRef = useRef<HTMLDivElement>(null);
  const { getParent } = useCurrentWindow();

  useContainerAutoHeight({
    containerRef,
    loading: false,
    getParent,
    layout: () => undefined,
    cssVariable: '--auth-page-height',
    useVisualViewportInset: true,
    deps: [getParent],
  });

  return (
    <ContentContainer title={settings.app.name}>
      <div ref={containerRef} className='flex flex-col overflow-auto h-(--auth-page-height)'>
        <div className='m-auto flex flex-col items-center px-2 md:px-0 max-w-100 w-full'>
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

          {settings.user.allowChangingLanguage && languages.length > 1 && (
            <Select
              className='mt-4'
              size='xs'
              aria-label={t('common.form.language', {})}
              leftSection={<FontAwesomeIcon icon={faGlobe} size='sm' />}
              data={languages.map((language) => ({
                label: new Intl.DisplayNames([language], { type: 'language' }).of(language) ?? language,
                value: language,
              }))}
              value={language}
              onChange={(value) => value && setLanguage(value)}
            />
          )}

          <Copyright className='mt-4 text-sm' />

          <ExtensionSlot components={authRegistry.appendedComponents} name='auth-appended' />
        </div>
      </div>
    </ContentContainer>
  );
}

export default makeComponentHookable(AuthWrapper);
