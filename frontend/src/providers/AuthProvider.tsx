import { ReactNode, startTransition, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import getMe from '@/api/me/getMe.ts';
import logout from '@/api/me/logout.ts';
import Spinner from '@/elements/Spinner.tsx';
import { fullUserSchema } from '@/lib/schemas/user.ts';
import { AuthContext } from '@/providers/contexts/authContext.ts';
import { useToast } from './ToastProvider.tsx';
import { useTranslations } from './TranslationProvider.tsx';
import { useWindows } from './WindowProvider.tsx';

const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { setToastPosition, addToast } = useToast();
  const { setLanguage } = useTranslations();
  const { closeAllWindows } = useWindows();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<z.infer<typeof fullUserSchema> | null>(null);
  const [impersonating, setImpersonating] = useState(window.localStorage.getItem('impersonated_user') !== null);

  useEffect(() => {
    if (user) {
      startTransition(() => {
        setToastPosition(user.toastPosition);
        setLanguage(user.language);
      });
    }
  }, [user, setToastPosition, setLanguage]);

  useEffect(() => {
    getMe()
      .then((user) => setUser(user))
      .catch(() => {
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const doImpersonate = (user: z.infer<typeof fullUserSchema>) => {
    localStorage.setItem('impersonated_user', user.uuid);

    navigate('/');
    closeAllWindows();
    setUser(user);
    setImpersonating(true);
  };

  const doLogin = (user: z.infer<typeof fullUserSchema>, doNavigate: boolean = true) => {
    setUser(user);
    if (doNavigate) {
      navigate('/');
    }
  };

  const doLogout = () => {
    if (localStorage.getItem('impersonated_user')) {
      localStorage.removeItem('impersonated_user');

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

    logout()
      .then(() => {
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
