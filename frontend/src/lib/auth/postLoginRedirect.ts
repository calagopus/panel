import { safeSessionStorageGet, safeSessionStorageRemove, safeSessionStorageSet } from '@/lib/safeStorage.ts';

const POST_LOGIN_REDIRECT_KEY = 'post-login-redirect';

let suppressed = false;

export function rememberPostLoginRedirect(target: string) {
  if (target === '/' || suppressed) return;

  safeSessionStorageSet(POST_LOGIN_REDIRECT_KEY, target);
}

export function readPostLoginRedirect(): string | null {
  return safeSessionStorageGet(POST_LOGIN_REDIRECT_KEY);
}

export function clearPostLoginRedirect() {
  safeSessionStorageRemove(POST_LOGIN_REDIRECT_KEY);
}

export function forgetPostLoginRedirect() {
  suppressed = true;
  clearPostLoginRedirect();
}

export function resumePostLoginRedirects() {
  suppressed = false;
}
