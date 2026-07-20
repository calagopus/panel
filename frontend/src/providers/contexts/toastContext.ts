import { IconDefinition } from '@fortawesome/free-solid-svg-icons';
import { createContext, MouseEvent as ReactMouseEvent, ReactNode, useContext } from 'react';
import { z } from 'zod';
import { userToastPosition } from '@/lib/schemas/user.ts';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
  name: string;
  icon: IconDefinition;
  disabled?: boolean;
  onClick: (e: ReactMouseEvent<HTMLButtonElement, MouseEvent>) => void | Promise<void>;
}

export interface Toast {
  id: number;
  message: ReactNode;
  type: ToastType;
  actions?: ToastAction[];
}

interface AddToast {
  (message: ReactNode, type?: ToastType, actions?: ToastAction[]): number;
  (message: ReactNode, actions: ToastAction[]): number;
}

interface ToastContextType {
  toastPosition: z.infer<typeof userToastPosition>;
  setToastPosition: (position: z.infer<typeof userToastPosition>) => void;

  addToast: AddToast;
  dismissToast: (id: number) => void;
}

export const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  return context;
};
