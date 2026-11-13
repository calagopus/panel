import { useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { ReactNode, startTransition, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { AuthImpersonateEvent, AuthLogoutEvent } from 'shared';
import { z } from 'zod';
import { getImpersonatedUser, httpErrorToHuman, setImpersonatedUser } from '@/api/axios.ts';
import getMe from '@/api/me/getMe.ts';
import logout from '@/api/me/logout.ts';
import ErrorState from '@/elements/feedback/ErrorState.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import { forgetPostLoginRedirect, rememberPostLoginRedirect } from '@/lib/auth/postLoginRedirect.ts';
import { clearFileDrafts } from '@/lib/files/fileDrafts.ts';
import { fullUserSchema } from '@/lib/schemas/user.ts';
import { flushUserSettings, getLastUserUuid, loadUserSettings, unloadUserSettings } from '@/lib/userSettings.ts';
import { AuthContext } from '@/providers/contexts/authContext.ts';
import { useUserStore } from '@/stores/user.ts';
import { useCurrentWindow } from './CurrentWindowProvider.tsx';
import { useToast } from './ToastProvider.tsx';
import { useTranslations } from './TranslationProvider.tsx';
import { useWindows } from './WindowProvider.tsx';

type User = z.infer<typeof fullUserSchema>;

interface IdentityMessage {
  type: 'identity';
  uuid: string | null;
}

const authChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('calagopus-auth') : null;
const IDENTITY_CHECK_INTERVAL_MS = 10_000;

const broadcastIdentity = (uuid: string | null) => {
  try {
    authChannel?.postMessage({ type: 'identity', uuid } satisfies IdentityMessage);
  } catch {
    // ignore
  }
};

const isLoggedOutError = (error: unknown) => {
  const status = isAxiosError(error) ? error.response?.status : undefined;
  return status === 401 || status === 403;
};

const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { addToast } = useToast();
  const { setLanguage } = useTranslations();
  const { closeAllWindows } = useWindows();
  const { id: windowId } = useCurrentWindow();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [user, setUser] = useState<User | null>(null);
  const [impersonating, setImpersonating] = useState(getImpersonatedUser() !== null);

  const userRef = useRef<User | null>(null);
  const sessionUuid = useRef<string | null | undefined>(undefined);
  const lastIdentityUuid = useRef<string | null>(null);
  const identityPending = useRef(false);

  const clearIdentityData = useCallback(
    (keepDrafts = false) => {
      queryClient.clear();
      useUserStore.getState().reset();
      if (!keepDrafts) clearFileDrafts();
    },
    [queryClient],
  );

  useEffect(() => {
    userRef.current = user;
    if (user) {
      lastIdentityUuid.current = user.uuid;
      startTransition(() => {
        setLanguage(user.language);
      });
      loadUserSettings(user.uuid);
    }
  }, [user, setLanguage]);

  const loadSession = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    identityPending.current = true;

    getMe()
      .then((me) => {
        setUser(me);
        if (!getImpersonatedUser()) sessionUuid.current = me.uuid;
      })
      .catch((error) => {
        if (!isLoggedOutError(error)) {
          setLoadError(error);
          return;
        }

        if (getImpersonatedUser()) {
          setImpersonatedUser(null);
          setImpersonating(false);

          return getMe()
            .then((me) => {
              setUser(me);
              sessionUuid.current = me.uuid;
            })
            .catch((error) => {
              if (isLoggedOutError(error)) {
                setUser(null);
                sessionUuid.current = null;
              } else {
                setLoadError(error);
              }
            });
        }

        setUser(null);
        sessionUuid.current = null;
      })
      .finally(() => {
        identityPending.current = false;
        setLoading(false);
      });
  }, []);

  useEffect(loadSession, [loadSession]);

  useEffect(() => {
    const handleSessionExpired = () => {
      if (identityPending.current) return;

      closeAllWindows();
      unloadUserSettings();

      if (getImpersonatedUser()) {
        setImpersonatedUser(null);
        setImpersonating(false);
        clearIdentityData();
        navigate('/');

        identityPending.current = true;
        setLoading(true);
        getMe()
          .then((me) => {
            setUser(me);
            sessionUuid.current = me.uuid;
          })
          .catch(() => {
            setUser(null);
            sessionUuid.current = null;
          })
          .finally(() => {
            identityPending.current = false;
            setLoading(false);
          });

        return;
      }

      if (!window.location.pathname.startsWith('/auth/')) {
        rememberPostLoginRedirect(window.location.pathname + window.location.search);
      }
      queryClient.clear();
      useUserStore.getState().reset();
      sessionUuid.current = null;
      setUser(null);
    };
    window.addEventListener('session-expired', handleSessionExpired);
    return () => window.removeEventListener('session-expired', handleSessionExpired);
  }, [queryClient, closeAllWindows, clearIdentityData, navigate]);

  useEffect(() => {
    if (windowId !== null) return;

    const handleMessage = (event: MessageEvent<IdentityMessage>) => {
      if (event.data?.type !== 'identity') return;

      const known = sessionUuid.current;
      if (known === undefined ? event.data.uuid === null : known !== event.data.uuid) {
        window.location.reload();
      }
    };

    let lastCheck = Date.now();
    const checkIdentity = () => {
      const current = userRef.current;
      if (document.visibilityState !== 'visible' || !current || identityPending.current) return;
      if (Date.now() - lastCheck < IDENTITY_CHECK_INTERVAL_MS) return;
      lastCheck = Date.now();

      getMe()
        .then((me) => {
          if (userRef.current?.uuid === current.uuid && me.uuid !== current.uuid) window.location.reload();
        })
        .catch((error) => {
          if (isAxiosError(error) && error.response?.status === 403) window.location.reload();
        });
    };

    authChannel?.addEventListener('message', handleMessage);
    window.addEventListener('focus', checkIdentity);
    document.addEventListener('visibilitychange', checkIdentity);

    return () => {
      authChannel?.removeEventListener('message', handleMessage);
      window.removeEventListener('focus', checkIdentity);
      document.removeEventListener('visibilitychange', checkIdentity);
    };
  }, [windowId]);

  const doImpersonate = async (target: User) => {
    const event = window.extensionContext.extensionRegistry.events.auth.impersonateHandlers.emit(
      new AuthImpersonateEvent(target, user),
    );
    if (event.cancelled) return;

    await flushUserSettings();

    const previousImpersonatedUser = getImpersonatedUser();
    setImpersonatedUser(target.uuid);
    identityPending.current = true;

    try {
      const impersonatedUser = await getMe();

      clearIdentityData();
      navigate('/');
      closeAllWindows();
      setUser(impersonatedUser);
      setImpersonating(true);
    } catch (msg) {
      setImpersonatedUser(previousImpersonatedUser);
      addToast(httpErrorToHuman(msg), 'error');
    } finally {
      identityPending.current = false;
    }
  };

  const doLogin = (user: User, doNavigate: boolean = true) => {
    const previousUuid = lastIdentityUuid.current ?? getLastUserUuid();

    if (getImpersonatedUser()) {
      setImpersonatedUser(null);
      setImpersonating(false);
    }

    closeAllWindows();
    clearIdentityData(previousUuid === user.uuid);
    sessionUuid.current = user.uuid;
    broadcastIdentity(user.uuid);
    setUser(user);
    if (doNavigate) {
      navigate('/');
    }
  };

  const doLogout = () => {
    const event = window.extensionContext.extensionRegistry.events.auth.logoutHandlers.emit(
      new AuthLogoutEvent(getImpersonatedUser() ? 'stopImpersonating' : 'logout', user),
    );
    if (event.cancelled) return;

    if (getImpersonatedUser()) {
      setImpersonatedUser(null);

      closeAllWindows();
      clearIdentityData();
      navigate('/');
      setLoading(true);
      identityPending.current = true;
      getMe()
        .then((user) => {
          setUser(user);
          sessionUuid.current = user.uuid;
          setImpersonating(false);
        })
        .catch(() => {
          setUser(null);
          sessionUuid.current = null;
          setImpersonating(false);
        })
        .finally(() => {
          identityPending.current = false;
          setLoading(false);
        });

      return;
    }

    setLoading(true);
    flushUserSettings()
      .then(() => logout())
      .then(() => {
        closeAllWindows();
        clearIdentityData();
        unloadUserSettings();
        sessionUuid.current = null;
        broadcastIdentity(null);
        forgetPostLoginRedirect();
        setUser(null);
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <AuthContext.Provider value={{ user, impersonating, setUser, doImpersonate, doLogin, doLogout }}>
      {loading ? (
        <Spinner.Centered />
      ) : loadError ? (
        <div className='flex h-full min-h-[50vh] items-center justify-center'>
          <ErrorState error={httpErrorToHuman(loadError)} onRetry={loadSession} />
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};

export { useAuth } from './contexts/authContext.ts';
export { AuthProvider };
