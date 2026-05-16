import { createContext, useContext } from 'react';

interface CurrentWindowContextType {
  id: number | null;
  getParent: () => HTMLDivElement | null;
}

export const CurrentWindowContext = createContext<CurrentWindowContextType | undefined>(undefined);

export const useCurrentWindow = (): CurrentWindowContextType => {
  const context = useContext(CurrentWindowContext);
  if (!context) {
    throw new Error('useCurrentWindow must be used within a CurrentWindowProvider');
  }

  return context;
};
