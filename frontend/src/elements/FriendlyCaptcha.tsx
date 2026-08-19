import {
  type FRCWidgetCompleteEvent,
  type FRCWidgetErrorEventData,
  FriendlyCaptchaSDK,
  type WidgetErrorData,
  type WidgetHandle,
} from '@friendlycaptcha/sdk';
import { useEffect, useImperativeHandle, useRef } from 'react';

const sdk = new FriendlyCaptchaSDK({
  apiEndpoint: 'global',
  disableEvalPatching: false,
});

export interface FriendlyCaptchaRef {
  getResponse: () => string | undefined;
  reset: () => void;
}

interface FriendlyCaptchaProps {
  sitekey: string;
  theme?: 'dark' | 'light' | 'auto';
  onComplete?: (response: string) => void;
  onError?: (error: WidgetErrorData) => void;
  onExpire?: () => void;
  ref?: React.Ref<FriendlyCaptchaRef>;
}

const FriendlyCaptcha = ({ sitekey, theme = 'dark', onComplete, onError, onExpire, ref }: FriendlyCaptchaProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<WidgetHandle | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const widget = sdk.createWidget({
      element: containerRef.current,
      sitekey,
      theme,
    });
    widgetRef.current = widget;

    return () => {
      widget.destroy();
      widgetRef.current = null;
    };
  }, [sitekey, theme]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const handleComplete = (e: Event) => {
      onComplete?.((e as FRCWidgetCompleteEvent).detail.response);
    };

    const handleError = (e: Event) => {
      onError?.((e as CustomEvent<FRCWidgetErrorEventData>).detail.error);
    };

    const handleExpire = () => {
      onExpire?.();
    };

    element.addEventListener('frc:widget.complete', handleComplete);
    element.addEventListener('frc:widget.error', handleError);
    element.addEventListener('frc:widget.expire', handleExpire);

    return () => {
      element.removeEventListener('frc:widget.complete', handleComplete);
      element.removeEventListener('frc:widget.error', handleError);
      element.removeEventListener('frc:widget.expire', handleExpire);
    };
  }, [onComplete, onError, onExpire]);

  useImperativeHandle(ref, () => ({
    getResponse: () => widgetRef.current?.getResponse(),
    reset: () => widgetRef.current?.reset(),
  }));

  return <div ref={containerRef} />;
};

export default FriendlyCaptcha;
