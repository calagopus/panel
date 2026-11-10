import type HCaptcha from '@hcaptcha/react-hcaptcha';
import type { TurnstileInstance } from '@marsidev/react-turnstile';
import type ReCAPTCHA from 'react-google-recaptcha';
import { useComputedColorScheme } from '@mantine/core';
import { lazy, Suspense, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { CapRef } from '@/elements/captcha/Cap.tsx';
import type { FriendlyCaptchaRef } from '@/elements/captcha/FriendlyCaptcha.tsx';
import { useGlobalStore } from '@/stores/global.ts';

const Cap = lazy(() => import('@/elements/captcha/Cap.tsx'));
const FriendlyCaptcha = lazy(() => import('@/elements/captcha/FriendlyCaptcha.tsx'));
const HCaptchaWidget = lazy(() => import('@hcaptcha/react-hcaptcha'));
const ReCAPTCHAWidget = lazy(() => import('react-google-recaptcha'));
const Turnstile = lazy(() => import('@marsidev/react-turnstile').then((module) => ({ default: module.Turnstile })));

export interface CaptchaRef {
  getToken: () => Promise<string | null>;
  resetCaptcha: () => void;
}

interface CaptchaProps {
  onValidChange?: (valid: boolean) => void;
  ref?: React.Ref<CaptchaRef>;
}

export function useCaptcha() {
  const [isValid, setIsValid] = useState(false);
  const ref = useRef<CaptchaRef>(null);
  const getToken = useCallback(async () => (await ref.current?.getToken()) ?? null, []);
  const props = useMemo<CaptchaProps>(() => ({ ref, onValidChange: setIsValid }), []);

  return { isValid, getToken, props } as const;
}

const Captcha = ({ onValidChange, ref }: CaptchaProps) => {
  const colorScheme = useComputedColorScheme('dark');
  const captchaProvider = useGlobalStore((state) => state.settings.captchaProvider);
  const isRecaptchaV3 = captchaProvider.type === 'recaptcha' && captchaProvider.v3;
  const hasWidget = captchaProvider.type !== 'none' && !isRecaptchaV3;

  const turnstileRef = useRef<TurnstileInstance>(null);
  const recaptchaRef = useRef<ReCAPTCHA>(null);
  const hcaptchaRef = useRef<HCaptcha>(null);
  const friendlyCaptchaRef = useRef<FriendlyCaptchaRef>(null);
  const capRef = useRef<CapRef>(null);

  const setValid = useCallback(() => onValidChange?.(true), [onValidChange]);
  const setInvalid = useCallback(() => onValidChange?.(false), [onValidChange]);

  useEffect(() => {
    if (!hasWidget) setValid();

    if (isRecaptchaV3 && !document.getElementById('recaptcha-v3-script')) {
      const script = document.createElement('script');
      script.id = 'recaptcha-v3-script';
      script.src = `https://www.google.com/recaptcha/api.js?render=${captchaProvider.siteKey}`;
      script.async = true;
      document.head.appendChild(script);
    }
  }, [captchaProvider, hasWidget, isRecaptchaV3, setValid]);

  const resetWidget = useCallback(() => {
    switch (captchaProvider.type) {
      case 'cap':
        capRef.current?.reset();
        break;
      case 'turnstile':
        turnstileRef.current?.reset();
        break;
      case 'hcaptcha':
        hcaptchaRef.current?.resetCaptcha();
        break;
      case 'friendly_captcha':
        friendlyCaptchaRef.current?.reset();
        break;
      case 'recaptcha':
        recaptchaRef.current?.reset();
        break;
    }
  }, [captchaProvider.type]);

  useImperativeHandle(
    ref,
    () => ({
      getToken: async () => {
        try {
          let token: string | null = null;

          switch (captchaProvider.type) {
            case 'cap':
              token = capRef.current?.getResponse() || null;
              break;
            case 'turnstile':
              token = turnstileRef.current?.getResponse() || null;
              break;
            case 'hcaptcha':
              token = hcaptchaRef.current?.getResponse() || null;
              break;
            case 'friendly_captcha':
              token = friendlyCaptchaRef.current?.getResponse() || null;
              break;
            case 'recaptcha':
              if (isRecaptchaV3) {
                if (!window.grecaptcha) return null;
                return new Promise<string | null>((resolve) => {
                  window.grecaptcha.ready(() => {
                    window.grecaptcha
                      .execute(captchaProvider.siteKey, { action: 'submit' })
                      .then((t: string) => resolve(t || null))
                      .catch(() => resolve(null));
                  });
                });
              }
              token = recaptchaRef.current?.getValue() || null;
              break;
            case 'none':
            default:
              return null;
          }

          if (token) {
            setInvalid();
            resetWidget();
          }

          return token;
        } catch {
          return null;
        }
      },
      resetCaptcha: () => {
        if (!hasWidget) return;
        setInvalid();
        resetWidget();
      },
    }),
    [captchaProvider, hasWidget, isRecaptchaV3, setInvalid, resetWidget],
  );

  if (!hasWidget) return null;

  return (
    <div key={`${captchaProvider.type}-${colorScheme}`} className='flex w-full items-center justify-center'>
      <Suspense>
        {captchaProvider.type === 'cap' && (
          <Cap
            ref={capRef}
            apiUrl={captchaProvider.apiUrl}
            siteKey={captchaProvider.siteKey}
            theme={colorScheme}
            onComplete={setValid}
            onExpire={setInvalid}
            onError={setInvalid}
          />
        )}

        {captchaProvider.type === 'turnstile' && (
          <Turnstile
            ref={turnstileRef}
            siteKey={captchaProvider.siteKey}
            options={{ size: 'flexible', theme: colorScheme }}
            onSuccess={setValid}
            onExpire={setInvalid}
            onError={setInvalid}
          />
        )}

        {captchaProvider.type === 'recaptcha' && (
          <ReCAPTCHAWidget
            ref={recaptchaRef}
            sitekey={captchaProvider.siteKey}
            theme={colorScheme}
            onChange={setValid}
            onExpired={setInvalid}
            onErrored={setInvalid}
          />
        )}

        {captchaProvider.type === 'hcaptcha' && (
          <HCaptchaWidget
            ref={hcaptchaRef}
            sitekey={captchaProvider.siteKey}
            theme={colorScheme}
            onVerify={setValid}
            onExpire={setInvalid}
            onError={setInvalid}
            onChalExpired={setInvalid}
          />
        )}

        {captchaProvider.type === 'friendly_captcha' && (
          <FriendlyCaptcha
            ref={friendlyCaptchaRef}
            sitekey={captchaProvider.siteKey}
            theme={colorScheme}
            onComplete={setValid}
            onExpire={setInvalid}
            onError={setInvalid}
          />
        )}
      </Suspense>
    </div>
  );
};

export default Captcha;
