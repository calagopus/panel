import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import classNames from 'classnames';
import { AnimatePresence, motion } from 'motion/react';
import { FC, MouseEvent as ReactMouseEvent, ReactNode, useCallback, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import Notification from '@/elements/feedback/Notification.tsx';
import Progress from '@/elements/feedback/Progress.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import { userToastPosition } from '@/lib/schemas/user.ts';
import { useToastPosition } from '@/plugins/toast/useToastPosition.ts';
import {
  ProgressToastOptions,
  Toast,
  ToastAction,
  ToastContext,
  ToastType,
  ToastUpdate,
  toastTimeout,
} from '@/providers/contexts/toastContext.ts';

const ToastActionButton: FC<{ action: ToastAction }> = ({ action }) => {
  const [loading, setLoading] = useState(false);
  const [triggered, setTriggered] = useState(false);
  const firedRef = useRef(false);

  const onClick = useCallback(
    (e: ReactMouseEvent<HTMLButtonElement, MouseEvent>) => {
      if (firedRef.current) return;
      firedRef.current = true;
      setTriggered(true);

      const res = action.onClick(e);

      if (res instanceof Promise) {
        setLoading(true);

        Promise.resolve(res).finally(() => setLoading(false));
      }
    },
    [action],
  );

  return (
    <Tooltip label={action.name} zIndex={1000}>
      <ActionIcon
        size='sm'
        variant='subtle'
        color='gray'
        loading={loading}
        disabled={action.disabled || triggered}
        onClick={onClick}
      >
        <FontAwesomeIcon icon={action.icon} size='sm' />
      </ActionIcon>
    </Tooltip>
  );
};

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

const getToastPositionClasses = (position: z.infer<typeof userToastPosition>) => {
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

const getToastPositionInitial = (position: z.infer<typeof userToastPosition>) => {
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

const ToastProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [toastPosition] = useToastPosition();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(1);

  const addToast = useCallback(
    (message: ReactNode, typeOrActions?: ToastType | ToastAction[], maybeActions?: ToastAction[]) => {
      const type = Array.isArray(typeOrActions) ? 'success' : (typeOrActions ?? 'success');
      const actions = Array.isArray(typeOrActions) ? typeOrActions : maybeActions;

      const id = toastId.current++;
      setToasts((prev) => [...prev, { id, message, type, actions, withCloseButton: true }]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, toastTimeout);

      return id;
    },
    [],
  );

  const addProgressToast = useCallback((message: ReactNode, options?: ProgressToastOptions) => {
    const id = toastId.current++;
    setToasts((prev) => [
      ...prev,
      {
        id,
        message,
        type: options?.type ?? 'info',
        actions: options?.actions,
        progress: options?.progress ?? null,
        withCloseButton: options?.withCloseButton ?? false,
        onClose: options?.onClose,
      },
    ]);

    return id;
  }, []);

  const updateToast = useCallback((id: number, update: ToastUpdate) => {
    setToasts((prev) => {
      const index = prev.findIndex((t) => t.id === id);
      if (index === -1) return prev;

      const toast = prev[index];
      const message = update.message === undefined ? toast.message : update.message;
      const type = update.type ?? toast.type;
      const actions = update.actions ?? toast.actions;
      const progress = update.progress === undefined ? toast.progress : update.progress;

      if (
        message === toast.message &&
        type === toast.type &&
        actions === toast.actions &&
        progress === toast.progress
      ) {
        return prev;
      }

      const next = [...prev];
      next[index] = { ...toast, message, type, actions, progress };

      return next;
    });
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const contextValue = useMemo(
    () => ({
      toastPosition,
      addToast,
      addProgressToast,
      updateToast,
      dismissToast,
    }),
    [toastPosition, addToast, addProgressToast, updateToast, dismissToast],
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className={classNames('fixed z-999 space-y-2', getToastPositionClasses(toastPosition))}>
        <AnimatePresence>
          {toasts.map((toast) => {
            const hasProgress = toast.progress !== undefined;

            return (
              <motion.div
                key={`toast_${toast.id}`}
                initial={getToastPositionInitial(toastPosition)}
                animate={{ opacity: 1, x: 0, y: 0 }}
                exit={getToastPositionInitial(toastPosition)}
                transition={{ duration: 0.3 }}
                className='w-72'
              >
                <div className='relative mt-2'>
                  <Notification
                    color={getToastColor(toast.type)}
                    withCloseButton={toast.withCloseButton}
                    onClose={() => (toast.onClose ? toast.onClose() : dismissToast(toast.id))}
                    styles={
                      !hasProgress && toast.actions?.length
                        ? { description: { paddingInlineEnd: toast.actions.length * 30 } }
                        : undefined
                    }
                  >
                    {hasProgress ? (
                      <div className='flex flex-col gap-2'>
                        <div className='flex flex-row items-center gap-1'>
                          <div className='min-w-0 grow'>{toast.message}</div>
                          {toast.actions?.map((action, i) => (
                            <ToastActionButton key={i} action={action} />
                          ))}
                        </div>
                        <Progress
                          value={toast.progress ?? 0}
                          indeterminate={toast.progress === null}
                          color={getToastColor(toast.type)}
                          hourglass={false}
                        />
                      </div>
                    ) : (
                      toast.message
                    )}
                  </Notification>
                  {!hasProgress && toast.actions?.length ? (
                    <div className='absolute top-1/2 right-9 flex -translate-y-1/2 items-center gap-1'>
                      {toast.actions.map((action, i) => (
                        <ToastActionButton key={i} action={action} />
                      ))}
                    </div>
                  ) : null}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export { useToast } from './contexts/toastContext.ts';
export { ToastProvider };
