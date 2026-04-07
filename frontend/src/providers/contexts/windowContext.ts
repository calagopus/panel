import { createContext, ReactNode, useContext } from 'react';

interface WindowContextType {
  addWindow: (title: string, component: ReactNode) => number;
  updateWindow: (id: number, title: string) => void;
  closeWindow: (id: number) => void;
  closeAllWindows: () => void;
}

export const WindowContext = createContext<WindowContextType | undefined>(undefined);

export const useWindows = (): WindowContextType => {
  const context = useContext(WindowContext);
  if (!context) {
    throw new Error('useWindows must be used within a WindowProvider');
  }

  return context;
};
