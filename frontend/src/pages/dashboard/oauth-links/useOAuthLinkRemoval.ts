import { useAuth } from '@/providers/AuthProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';

export function useOAuthLinkRemoval(totalLinks: number) {
  const { user } = useAuth();
  const passwordLoginEnabled = useGlobalStore((state) => state.settings.app.passwordLoginEnabled);

  const canLoginWithPassword = Boolean(user?.hasPassword && passwordLoginEnabled && !user.passwordLoginDisabled);
  const hasSecurityKey = Boolean(user?.twoFactorMethods.includes('security_key'));
  const hasOtherLoginMethod = canLoginWithPassword || hasSecurityKey;

  const removableCount = hasOtherLoginMethod ? totalLinks : Math.max(totalLinks - 1, 0);

  return { hasOtherLoginMethod, isLastLoginMethod: !hasOtherLoginMethod && totalLinks <= 1, removableCount };
}
