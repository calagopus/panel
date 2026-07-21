import HCaptcha from '@hcaptcha/react-hcaptcha';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';

import { useGlobalStore } from '@/stores/global.ts';
import FriendlyCaptcha, { type Ref as FriendlyCaptchaRef } from './FriendlyCaptcha.tsx';

export interface CaptchaRef {
  getToken: () => Promise<string | null>;
  resetCaptcha: () => void;
}

interface CaptchaProps {
  onValidChange?: (valid: boolean) => void;
  ref?: React.Ref<CaptchaRef>;
}

const Captcha = ({ onValidChange, ref }: CaptchaProps) => {
  const captchaProvider = useGlobalStore((state) => state.settings.captchaProvider);

  const turnstileRef = useRef<TurnstileInstance>(null);
  const recaptchaRef = useRef<ReCAPTCHA>(null);
  const hcaptchaRef = useRef<HCaptcha>(null);
  const friendlyCaptchaRef = useRef<FriendlyCaptchaRef>(null);

  const handleSuccess = useCallback(() => onValidChange?.(true), [onValidChange]);
  const handleError = useCallback(() => onValidChange?.(false), [onValidChange]);
  const handleRecaptcha = useCallback((token: string | null) => onValidChange?.(!!token), [onValidChange]);

  useEffect(() => {
    if (captchaProvider.type === 'none') {
      handleSuccess();
      return;
    }

    if (captchaProvider.type === 'recaptcha' && captchaProvider.v3) {
      handleSuccess();

      const scriptId = 'recaptcha-v3-script';
      if (!document.getElementById(scriptId)) {
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = `https://www.google.com/recaptcha/api.js?render=${captchaProvider.siteKey}`;
        script.async = true;
        document.head.appendChild(script);
      }
    }
  }, [captchaProvider, handleSuccess]);

  useImperativeHandle(
    ref,
    () => ({
      getToken: async () => {
        try {
          switch (captchaProvider.type) {
            case 'turnstile':
              return turnstileRef.current?.getResponse() ?? null;
            case 'hcaptcha':
              return hcaptchaRef.current?.getResponse() ?? null;
            case 'friendly_captcha':
              return friendlyCaptchaRef.current?.getResponse() ?? null;
            case 'recaptcha':
              if (captchaProvider.v3) {
                return window.grecaptcha
                  ? await window.grecaptcha.execute(captchaProvider.siteKey, {
                      action: 'submit',
                    })
                  : null;
              }
              return recaptchaRef.current?.getValue() ?? null;
            case 'none':
            default:
              return null;
          }
        } catch {
          return null;
        }
      },
      resetCaptcha: () => {
        handleError();

        switch (captchaProvider.type) {
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
            if (!captchaProvider.v3) recaptchaRef.current?.reset();
            break;
        }
      },
    }),
    [captchaProvider, handleError],
  );

  if (captchaProvider.type === 'none' || (captchaProvider.type === 'recaptcha' && captchaProvider.v3)) {
    return null;
  }

  return (
    <div className='flex w-full items-center justify-center'>
      {captchaProvider.type === 'turnstile' && (
        <Turnstile
          ref={turnstileRef}
          siteKey={captchaProvider.siteKey}
          options={{ size: 'flexible' }}
          onSuccess={handleSuccess}
          onExpire={handleError}
          onError={handleError}
        />
      )}

      {captchaProvider.type === 'recaptcha' && !captchaProvider.v3 && (
        <ReCAPTCHA
          ref={recaptchaRef}
          sitekey={captchaProvider.siteKey}
          onChange={handleRecaptcha}
          onExpired={handleError}
        />
      )}

      {captchaProvider.type === 'hcaptcha' && (
        <HCaptcha
          ref={hcaptchaRef}
          sitekey={captchaProvider.siteKey}
          onVerify={handleSuccess}
          onExpire={handleError}
          onError={handleError}
        />
      )}

      {captchaProvider.type === 'friendly_captcha' && (
        <FriendlyCaptcha
          ref={friendlyCaptchaRef}
          sitekey={captchaProvider.siteKey}
          onComplete={handleSuccess}
          onExpire={handleError}
          onError={handleError}
        />
      )}
    </div>
  );
};

export default Captcha;
