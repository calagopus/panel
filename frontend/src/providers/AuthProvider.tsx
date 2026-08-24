import { useQueryClient } from '@tanstack/react-query';
import { ReactNode, startTransition, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { getImpersonatedUser, httpErrorToHuman, setImpersonatedUser } from '@/api/axios.ts';
import getMe from '@/api/me/getMe.ts';
import logout from '@/api/me/logout.ts';
import Spinner from '@/elements/Spinner.tsx';
import { fullUserSchema } from '@/lib/schemas/user.ts';
import { flushUserSettings, loadUserSettings, unloadUserSettings } from '@/lib/userSettings.ts';
import { AuthContext } from '@/providers/contexts/authContext.ts';
import { useUserStore } from '@/stores/user.ts';
import { useToast } from './ToastProvider.tsx';
import { useTranslations } from './TranslationProvider.tsx';
import { useWindows } from './WindowProvider.tsx';

const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { setToastPosition, addToast } = useToast();
  const { setLanguage } = useTranslations();
  const { closeAllWindows } = useWindows();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const clearIdentityData = () => {
    queryClient.clear();
    useUserStore.getState().reset();
  };

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<z.infer<typeof fullUserSchema> | null>(null);
  const [impersonating, setImpersonating] = useState(getImpersonatedUser() !== null);

  useEffect(() => {
    if (user) {
      startTransition(() => {
        setToastPosition(user.toastPosition);
        setLanguage(user.language);
      });
      loadUserSettings(user.uuid);
    }
  }, [user, setToastPosition, setLanguage]);

  useEffect(() => {
    getMe()
      .then((user) => setUser(user))
      .catch(() => {
        if (getImpersonatedUser()) {
          setImpersonatedUser(null);
          setImpersonating(false);

          return getMe()
            .then((user) => setUser(user))
            .catch(() => setUser(null));
        }

        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handleSessionExpired = () => {
      if (!window.location.pathname.startsWith('/auth/')) {
        sessionStorage.setItem('post-login-redirect', window.location.pathname + window.location.search);
      }
      queryClient.clear();
      useUserStore.getState().reset();
      unloadUserSettings();
      setUser(null);
    };
    window.addEventListener('session-expired', handleSessionExpired);
    return () => window.removeEventListener('session-expired', handleSessionExpired);
  }, [queryClient]);

  const doImpersonate = async (user: z.infer<typeof fullUserSchema>) => {
    await flushUserSettings();

    const previousImpersonatedUser = getImpersonatedUser();
    setImpersonatedUser(user.uuid);

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
    }
  };

  const doLogin = (user: z.infer<typeof fullUserSchema>, doNavigate: boolean = true) => {
    clearIdentityData();
    setUser(user);
    if (doNavigate) {
      navigate('/');
    }
  };

  const doLogout = () => {
    if (getImpersonatedUser()) {
      setImpersonatedUser(null);

      clearIdentityData();
      navigate('/');
      setLoading(true);
      getMe()
        .then((user) => {
          setUser(user);
          setImpersonating(false);
        })
        .catch(() => {
          setUser(null);
          setImpersonating(false);
        })
        .finally(() => setLoading(false));

      return;
    }

    flushUserSettings()
      .then(() => logout())
      .then(() => {
        clearIdentityData();
        unloadUserSettings();
        setUser(null);
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  return (
    <AuthContext.Provider value={{ user, impersonating, setUser, doImpersonate, doLogin, doLogout }}>
      {loading ? <Spinner.Centered /> : children}
    </AuthContext.Provider>
  );
};

export { useAuth } from './contexts/authContext.ts';
export { AuthProvider };
