import { faChevronDown, faChevronUp, faExclamationCircle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { ReactNode } from 'react';
import { Component, type ErrorInfo } from 'react';
import { TranslationContext } from 'shared';
import { getGlobalStore } from '@/stores/global.ts';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  static contextType = TranslationContext;
  declare context: React.ContextType<typeof TranslationContext>;

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
    if (this.state.hasError) {
      const { error, errorInfo, showDetails } = this.state;
      const appDebug = getGlobalStore().settings.app.debug;
      const _t = (key: string) => this.context?.t(key, {});

      return (
        <div className='flex items-center justify-center w-full p-6'>
          <div className='max-w-4xl w-full'>
            <div className='flex flex-col items-center text-center mb-6'>
              <div className='w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4'>
                <FontAwesomeIcon icon={faExclamationCircle} className='w-6 h-6 text-red-400' />
              </div>
              <p className='text-sm text-neutral-400 leading-relaxed'>
                {this.context?.t('elements.errorBoundary.message', {}) ||
                  'An unexpected error occurred while rendering this page. Try refreshing. If the problem persists, contact your system administrator.'}
              </p>
            </div>

            <div className='flex justify-center mb-4'>
              <button
                onClick={() => window.location.reload()}
                className='px-4 py-2 text-sm font-medium rounded-md bg-neutral-700 hover:bg-neutral-600 text-neutral-100 transition-colors'
              >
                Refresh page
              </button>
            </div>

            {error && appDebug && (
              <div className='mt-2 border bg-neutral-800 border-neutral-700/60 rounded-lg overflow-hidden'>
                <button
                  onClick={this.toggleDetails}
                  className='w-full flex items-center justify-between px-4 py-3 text-xs text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50 transition-colors'
                >
                  <span className='font-medium tracking-wide uppercase'>
                    {showDetails
                      ? this.context?.t('elements.errorBoundary.hideDetails', {}) || 'Hide Details'
                      : this.context?.t('elements.errorBoundary.showDetails', {}) || 'Show Details'}
                  </span>
                  <FontAwesomeIcon icon={showDetails ? faChevronUp : faChevronDown} className='h-3 w-auto mr-1' />
                </button>

                {showDetails && (
                  <div className='rounded p-3 mt-2 space-y-3'>
                    <div>
                      <p className='text-xs font-semibold text-red-400 mb-1'>
                        {this.context?.t('elements.errorBoundary.errorMessage', {}) || 'Error Message:'}
                      </p>
                      <pre className='text-xs text-neutral-300 whitespace-pre-wrap wrap-break-word bg-neutral-950 p-2 rounded'>
                        {error.message || this.context?.t('common.na', {}) || 'N/A'}
                      </pre>
                    </div>

                    {error.stack && (
                      <div>
                        <p className='text-xs font-semibold text-red-400 mb-1'>
                          {this.context?.t('elements.errorBoundary.stackTrace', {}) || 'Stack Trace:'}
                        </p>
                        <pre className='text-xs text-neutral-300 whitespace-pre-wrap wrap-break-word bg-neutral-950 p-2 rounded overflow-x-auto'>
                          {error.stack}
                        </pre>
                      </div>
                    )}

                    {errorInfo && errorInfo.componentStack && (
                      <div>
                        <p className='text-xs font-semibold text-red-400 mb-1'>
                          {this.context?.t('elements.errorBoundary.componentStack', {}) || 'Component Stack:'}
                        </p>
                        <pre className='text-xs text-neutral-300 whitespace-pre-wrap wrap-break-word bg-neutral-950 p-2 rounded overflow-x-auto'>
                          {errorInfo.componentStack}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
