import { CSSVariablesResolver, MantineProvider, type MantineThemeOverride, Text } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { createBrowserHistory } from 'history';
import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import AssetReloadNotice from '@/elements/feedback/AssetReloadNotice.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import getAnnouncements from './api/getAnnouncements.ts';
import getLanguages from './api/getLanguages.ts';
import getSettings from './api/getSettings.ts';
import ErrorBoundary from './elements/ErrorBoundary.tsx';
import ExtensionSlot from './elements/ExtensionSlot.tsx';
import { HistoryContext } from './providers/contexts/historyContext.ts';
import { CurrentWindowProvider } from './providers/CurrentWindowProvider.tsx';
import { ToastProvider } from './providers/ToastProvider.tsx';
import TranslationProvider from './providers/TranslationProvider.tsx';
import { WindowProvider } from './providers/WindowProvider.tsx';
import RouterRoutes from './RouterRoutes.tsx';
import TransitionHistoryRouter from './routers/TransitionHistoryRouter.tsx';
import { useGlobalStore } from './stores/global.ts';

import '@mantine/core/styles.css';
import '@gfazioli/mantine-window/styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      refetchOnMount: 'always',
      retry: 1,
    },
  },
});

const browserHistory = createBrowserHistory();

const MAX_RETRIES = 10;

export default function App({
  theme,
  cssVariablesResolver,
  settingsLoaded,
}: {
  theme: MantineThemeOverride;
  cssVariablesResolver: CSSVariablesResolver | null;
  settingsLoaded: boolean;
}) {
  const { settings, setSettings, setLanguages, setTimeOffset, setAnnouncements } = useGlobalStore(
    useShallow((state) => ({
      settings: state.settings,
      setSettings: state.setSettings,
      setLanguages: state.setLanguages,
      setTimeOffset: state.setTimeOffset,
      setAnnouncements: state.setAnnouncements,
    })),
  );
  const [loadWarning, setLoadWarning] = useState(false);
  const retryCount = useRef(0);
  const settingsFresh = useRef(settingsLoaded);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const loadData = () => {
      const loadSettings = settingsFresh.current ? Promise.resolve(null) : getSettings();

      Promise.all([loadSettings, getLanguages()])
        .then(([settings, languages]) => {
          if (cancelled) return;

          if (settings) {
            settingsFresh.current = true;
            setSettings(settings);
            setTimeOffset(Date.now() - new Date(settings.time).getTime());
          }
          setLanguages(languages);
        })
        .catch((err) => {
          if (cancelled) return;
          retryCount.current++;
          console.error(`Failed to load app data (attempt ${retryCount.current}):`, err);

          if (retryCount.current >= 2) {
            setLoadWarning(true);
          }

          if (retryCount.current < MAX_RETRIES) {
            timer = setTimeout(loadData, Math.min(retryCount.current * 2000, 10000));
          }
        });

      getAnnouncements()
        .then((announcements) => {
          setAnnouncements(announcements);
        })
        .catch((err) => {
          console.error('Failed to load announcements:', err);
        });
    };

    loadData();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (settings?.app?.icon) {
      const icons = document.getElementsByClassName('app-icon');

      for (const icon of icons) {
        (icon as HTMLLinkElement).href = settings.app.icon;
      }
    }
  }, [settings?.app?.icon]);

  return (
    <>
      {Object.keys(settings).length > 0 ? (
        <ErrorBoundary theme={theme}>
          <MantineProvider
            theme={theme}
            cssVariablesResolver={cssVariablesResolver || undefined}
            defaultColorScheme='dark'
            deduplicateInlineStyles
          >
            <QueryClientProvider client={queryClient}>
              <TranslationProvider>
                <ToastProvider>
                  <WindowProvider>
                    <CurrentWindowProvider id={null}>
                      <HistoryContext.Provider value={browserHistory}>
                        <TransitionHistoryRouter history={browserHistory}>
                          <ExtensionSlot
                            components={window.extensionContext.extensionRegistry.global.prependedComponents}
                            name='global-prepended'
                          />

                          <RouterRoutes isNormal />

                          <ExtensionSlot
                            components={window.extensionContext.extensionRegistry.global.appendedComponents}
                            name='global-appended'
                          />
                        </TransitionHistoryRouter>
                      </HistoryContext.Provider>

                      <ReactQueryDevtools initialIsOpen={false} theme='dark' />
                    </CurrentWindowProvider>
                  </WindowProvider>
                </ToastProvider>
              </TranslationProvider>
            </QueryClientProvider>
          </MantineProvider>
        </ErrorBoundary>
      ) : (
        <>
          <MantineProvider theme={theme} defaultColorScheme='dark' deduplicateInlineStyles>
            <Spinner.Centered />
            {loadWarning && (
              <Text size='sm' c='dimmed' ta='center'>
                Having trouble connecting to the server. Retrying...
              </Text>
            )}
          </MantineProvider>
        </>
      )}

      <AssetReloadNotice />
    </>
  );
}
