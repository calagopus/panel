import type { ReactNode } from 'react';
import { faChevronDown, faChevronUp, faRotateRight, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Code, Collapse, MantineProvider, type MantineThemeOverride, Stack, Text } from '@mantine/core';
import { Component, type ErrorInfo } from 'react';
import { globalTranslationHandle } from 'shared';
import Button from '@/elements/buttons/Button.tsx';
import ThemeIcon from '@/elements/data-display/ThemeIcon.tsx';
import { getTranslations } from '@/providers/TranslationProvider.tsx';
import { useAssetReloadStore } from '@/stores/assetReload.ts';
import { getGlobalStore } from '@/stores/global.ts';

interface Props {
  theme: MantineThemeOverride;
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

const fallbacks = {
  message:
    'An unexpected error occurred while rendering this page. Try refreshing. If the problem persists, contact your system administrator.',
  refresh: 'Refresh Page',
  hideDetails: 'Hide Details',
  showDetails: 'Show Details',
  errorMessage: 'Error Message:',
  stackTrace: 'Stack Trace:',
  componentStack: 'Component Stack:',
};

// mounted above TranslationProvider, so translations come from the global handle when one was set up
function text(key: keyof typeof fallbacks) {
  return globalTranslationHandle ? getTranslations().t(`elements.errorBoundary.${key}`, {}) : fallbacks[key];
}

function DetailBlock({ label, content }: { label: string; content: string }) {
  return (
    <div>
      <Text size='xs' fw={600} c='red' mb={4}>
        {label}
      </Text>
      <Code block className='max-h-80 overflow-auto whitespace-pre-wrap wrap-break-word'>
        {content}
      </Code>
    </div>
  );
}

class ErrorBoundary extends Component<Props, State> {
  override state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
  };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  override render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (useAssetReloadStore.getState().status !== 'idle') return null;

    const { error, errorInfo, showDetails } = this.state;
    const appDebug = getGlobalStore().settings.app.debug;

    return (
      <MantineProvider theme={this.props.theme} defaultColorScheme='dark'>
        <div className='flex justify-center w-full p-6'>
          <Stack align='center' gap='sm' className='w-full max-w-4xl'>
            <ThemeIcon size='xl' radius='md' variant='light' color='red'>
              <FontAwesomeIcon icon={faTriangleExclamation} />
            </ThemeIcon>
            <Text size='sm' c='dimmed' ta='center' className='max-w-xl'>
              {text('message')}
            </Text>
            <Button
              variant='default'
              leftSection={<FontAwesomeIcon icon={faRotateRight} />}
              onClick={() => window.location.reload()}
            >
              {text('refresh')}
            </Button>

            {error && appDebug && (
              <div className='w-full mt-4 rounded-md border border-(--mantine-color-default-border) bg-(--mantine-color-default) overflow-hidden'>
                <Button
                  variant='subtle'
                  color='gray'
                  fullWidth
                  radius={0}
                  justify='space-between'
                  onClick={this.toggleDetails}
                  rightSection={<FontAwesomeIcon icon={showDetails ? faChevronUp : faChevronDown} />}
                >
                  {showDetails ? text('hideDetails') : text('showDetails')}
                </Button>

                <Collapse expanded={showDetails}>
                  <Stack gap='sm' p='md' pt={0}>
                    <DetailBlock label={text('errorMessage')} content={error.message || 'N/A'} />
                    {error.stack && <DetailBlock label={text('stackTrace')} content={error.stack} />}
                    {errorInfo?.componentStack && (
                      <DetailBlock label={text('componentStack')} content={errorInfo.componentStack} />
                    )}
                  </Stack>
                </Collapse>
              </div>
            )}
          </Stack>
        </div>
      </MantineProvider>
    );
  }
}

export default ErrorBoundary;
