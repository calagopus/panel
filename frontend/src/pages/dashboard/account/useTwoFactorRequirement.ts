import { z } from 'zod';
import { isTwoFactorMethodAvailable } from '@/lib/auth/twoFactor.ts';
import { twoFactorMethod } from '@/lib/schemas/user.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';

type TwoFactorMethod = z.infer<typeof twoFactorMethod>;

export function useTwoFactorRequirement() {
  const { t } = useTranslations();
  const { user } = useAuth();
  const settings = useGlobalStore((state) => state.settings);

  const methodLabel = (method: TwoFactorMethod) =>
    method === 'totp'
      ? t('pages.account.account.containers.twoFactor.enum.twoFactorMethod.totp', {})
      : method === 'security_key'
        ? t('pages.account.account.containers.twoFactor.enum.twoFactorMethod.securityKey', {})
        : t('pages.account.account.containers.twoFactor.enum.twoFactorMethod.email', {});

  const isAccepted = (method: TwoFactorMethod) => settings.app.twoFactorAcceptedMethods.includes(method);

  const availableAcceptedMethods = settings.app.twoFactorAcceptedMethods.filter((method) =>
    isTwoFactorMethodAvailable(method, {
      webauthnEnabled: settings.webauthn.enabled,
      emailTwoFactorEnabled: settings.app.emailTwoFactorEnabled,
    }),
  );

  const acceptedMethodsList = availableAcceptedMethods.map((method) => `**${methodLabel(method)}**`).join(', ');

  const isLastAcceptedMethod = (method: TwoFactorMethod) =>
    Boolean(user?.requireTwoFactor) &&
    isAccepted(method) &&
    !user!.twoFactorMethods.some((m) => m !== method && isAccepted(m));

  return { methodLabel, isAccepted, isLastAcceptedMethod, availableAcceptedMethods, acceptedMethodsList };
}
