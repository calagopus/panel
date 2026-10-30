import { createContext, useContext } from 'react';
import { z } from 'zod';
import { fullUserSchema } from '@/lib/schemas/user.ts';

export interface AuthContextType {
  user: z.infer<typeof fullUserSchema> | null;
  impersonating: boolean;

  setUser: (user: z.infer<typeof fullUserSchema> | null) => void;
  doImpersonate: (user: z.infer<typeof fullUserSchema>) => Promise<void>;
  doLogin: (user: z.infer<typeof fullUserSchema>, doNavigate?: boolean) => void;
  doLogout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within a AuthProvider');
  }
  return context;
};
