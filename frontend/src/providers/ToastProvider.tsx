import classNames from 'classnames';
import { AnimatePresence, motion } from 'motion/react';
import { createContext, FC, ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import Notification from '@/elements/Notification.tsx';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toastPosition: UserToastPosition;
  setToastPosition: (position: UserToastPosition) => void;

  addToast: (message: string, type?: ToastType) => number;
  dismissToast: (id: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

let toastId = 0;

const toastTimeout = 7500;

const getToastColor = (type: ToastType) => {
  switch (type) {
    case 'success':
      return 'green';
    case 'error':
      return 'red';
    case 'warning':
      return 'yellow';
    default:
      return 'teal';
  }
};

const getToastPositionClasses = (position: UserToastPosition) => {
  switch (position) {
    case 'top_left':
      return 'top-4 left-4';
    case 'top_center':
      return 'top-4 left-1/2 -translate-x-1/2';
    case 'top_right':
      return 'top-4 right-4';
    case 'bottom_left':
      return 'bottom-4 left-4';
    case 'bottom_center':
      return 'bottom-4 left-1/2 -translate-x-1/2';
    case 'bottom_right':
      return 'bottom-4 right-4';
  }
};

const getToastPositionInitial = (position: UserToastPosition) => {
  switch (position) {
    case 'top_left':
      return { opacity: 0, x: -50, y: 0 };
    case 'top_center':
      return { opacity: 0, x: 0, y: -75 };
    case 'top_right':
      return { opacity: 0, x: 50, y: 0 };
    case 'bottom_left':
      return { opacity: 0, x: -50, y: 0 };
    case 'bottom_center':
      return { opacity: 0, x: 0, y: 75 };
    case 'bottom_right':
      return { opacity: 0, x: 50, y: 0 };
  }
};

export const ToastProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [toastPosition, setToastPosition] = useState<UserToastPosition>('bottom_right');
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = toastId++;
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, toastTimeout);

    return id;
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const contextValue = useMemo(
    () => ({
      toastPosition,
      setToastPosition,
      addToast,
      dismissToast,
    }),
    [toastPosition, setToastPosition, addToast, dismissToast],
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className={classNames('fixed z-999 space-y-2', getToastPositionClasses(toastPosition))}>
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={getToastPositionInitial(toastPosition)}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={getToastPositionInitial(toastPosition)}
              transition={{ duration: 0.3 }}
              className='w-72'
            >
              <div className='pt-2 px-12'>
                <Notification color={getToastColor(toast.type)} withCloseButton onClose={() => dismissToast(toast.id)}>
                  {toast.message}
                </Notification>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  return context;
};
