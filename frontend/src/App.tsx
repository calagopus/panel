import { MantineProvider, type MantineThemeOverride, v8CssVariablesResolver } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { createBrowserHistory } from 'history';
import { useEffect, useRef, useState } from 'react';
import { unstable_HistoryRouter as HistoryRouter } from 'react-router';
import getLanguages from './api/getLanguages.ts';
import getSettings from './api/getSettings.ts';
import ErrorBoundary from './elements/ErrorBoundary.tsx';
import Spinner from './elements/Spinner.tsx';
import { CurrentWindowProvider } from './providers/CurrentWindowProvider.tsx';
import { HistoryContext } from './providers/contexts/historyContext.ts';
import { ToastProvider } from './providers/ToastProvider.tsx';
import TranslationProvider from './providers/TranslationProvider.tsx';
import { WindowProvider } from './providers/WindowProvider.tsx';
import RouterRoutes from './RouterRoutes.tsx';
import { useGlobalStore } from './stores/global.ts';

import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@gfazioli/mantine-window/styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const browserHistory = createBrowserHistory();

const MAX_RETRIES = 10;

export default function App({ theme }: { theme: MantineThemeOverride }) {
  const { settings, setSettings, setLanguages, setTimeOffset } = useGlobalStore();
  const [loadWarning, setLoadWarning] = useState(false);
  const retryCount = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const loadData = () => {
      Promise.all([getSettings(), getLanguages()])
        .then(([settings, languages]) => {
          if (cancelled) return;

          setSettings(settings);
          setLanguages(languages);
          setTimeOffset(Date.now() - new Date(settings.time).getTime());
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

  return Object.keys(settings).length > 0 ? (
    <ErrorBoundary>
      <MantineProvider
        theme={theme}
        forceColorScheme='dark'
        cssVariablesResolver={v8CssVariablesResolver}
        deduplicateInlineStyles
      >
        <QueryClientProvider client={queryClient}>
          <TranslationProvider>
            <ToastProvider>
              <WindowProvider>
                <CurrentWindowProvider id={null}>
                  <HistoryContext.Provider value={browserHistory}>
                    <HistoryRouter history={browserHistory as never}>
                      {window.extensionContext.extensionRegistry.global.prependedComponents.map((Component, index) => (
                        <Component key={`global-prepended-${index}`} />
                      ))}

                      <RouterRoutes isNormal />

                      {window.extensionContext.extensionRegistry.global.appendedComponents.map((Component, index) => (
                        <Component key={`global-appended-${index}`} />
                      ))}
                    </HistoryRouter>
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
      <Spinner.Centered />
      {loadWarning && (
        <p className='text-center text-sm text-slate-400 -mt-4'>Having trouble connecting to the server. Retrying...</p>
      )}
    </>
  );
}
