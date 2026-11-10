import type { CapSolveEvent, CapWidget } from 'cap-widget';
import wasmUrl from '@cap.js/wasm/browser/cap_wasm_bg.wasm?url';
import hashwxUrl from '@cap.js/wasm/browser/hashwx.wasm?url';
import pakoUrl from 'pako/dist/browser/pako_inflate.umd.min.js?url';
import { useEffect, useImperativeHandle, useRef } from 'react';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export interface CapRef {
  getResponse: () => string | null;
  reset: () => void;
}

interface CapProps {
  apiUrl: string;
  siteKey: string;
  theme: 'dark' | 'light';
  onComplete: () => void;
  onError: () => void;
  onExpire: () => void;
  ref?: React.Ref<CapRef>;
}

const Cap = ({ apiUrl, siteKey, theme, onComplete, onError, onExpire, ref }: CapProps) => {
  const { language } = useTranslations();
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<CapWidget | null>(null);
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let widget: CapWidget | null = null;
    tokenRef.current = null;
    onExpire();

    window.CAP_CUSTOM_WASM_URL = wasmUrl;
    window.CAP_CUSTOM_HASHWX_URL = hashwxUrl;
    window.CAP_PAKO_URL = pakoUrl;
    window.CAP_SCRIPT_NONCE = document.querySelector<HTMLMetaElement>('meta[name="cap-script-nonce"]')?.content;

    const handleSolve = (event: CapSolveEvent) => {
      tokenRef.current = event.detail.token;
      onComplete();
    };
    const handleReset = () => {
      tokenRef.current = null;
      onExpire();
    };
    const handleError = () => {
      tokenRef.current = null;
      onError();
    };

    import('cap-widget')
      .then(() => {
        if (disposed) return;

        widget = document.createElement('cap-widget');
        widget.setAttribute('data-cap-api-endpoint', `${apiUrl.replace(/\/+$/, '')}/${siteKey}/`);
        widget.setAttribute('data-cap-lang', language);
        widget.style.setProperty('--cap-background', 'var(--mantine-color-body)');
        widget.style.setProperty('--cap-color', 'var(--mantine-color-text)');
        widget.style.setProperty('--cap-border-color', theme === 'dark' ? '#424242' : '#dee2e6');
        widget.style.setProperty('--cap-checkbox-background', 'var(--mantine-color-body)');
        widget.style.setProperty('--cap-spinner-color', 'var(--mantine-color-text)');
        widget.addEventListener('solve', handleSolve);
        widget.addEventListener('reset', handleReset);
        widget.addEventListener('error', handleError);
        widgetRef.current = widget;
        container.appendChild(widget);
      })
      .catch(() => {
        if (!disposed) handleError();
      });

    return () => {
      disposed = true;
      widget?.removeEventListener('solve', handleSolve);
      widget?.removeEventListener('reset', handleReset);
      widget?.removeEventListener('error', handleError);
      widget?.remove();
      widgetRef.current = null;
      tokenRef.current = null;
    };
  }, [apiUrl, siteKey, theme, language, onComplete, onError, onExpire]);

  useImperativeHandle(ref, () => ({
    getResponse: () => tokenRef.current,
    reset: () => {
      tokenRef.current = null;
      widgetRef.current?.reset();
    },
  }));

  return <div ref={containerRef} />;
};

export default Cap;
