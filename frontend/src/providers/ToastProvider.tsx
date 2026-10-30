import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import classNames from 'classnames';
import { AnimatePresence, LazyMotion, m } from 'motion/react';
import { FC, MouseEvent as ReactMouseEvent, ReactNode, useCallback, useMemo, useRef, useState } from 'react';
import { ToastDismissEvent, ToastDismissReason, ToastShowData, ToastShowEvent, ToastUpdateEvent } from 'shared';
import { z } from 'zod';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import Notification from '@/elements/feedback/Notification.tsx';
import Progress from '@/elements/feedback/Progress.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import { userToastPosition } from '@/lib/schemas/user.ts';
import { useToastPosition } from '@/plugins/toast/useToastPosition.ts';
import {
  PendingToast,
  ProgressToastOptions,
  pendingToastDelay,
  Toast,
  ToastAction,
  ToastContext,
  ToastType,
  ToastUpdate,
  toastTimeout,
} from '@/providers/contexts/toastContext.ts';

const loadMotionFeatures = () => import('@/lib/motionFeatures.ts').then((module) => module.default);

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
  const toastsRef = useRef<Toast[]>([]);
  const toastId = useRef(1);

  const setToastList = useCallback((update: (prev: Toast[]) => Toast[]) => {
    const next = update(toastsRef.current);
    if (next === toastsRef.current) return;

    toastsRef.current = next;
    setToasts(next);
  }, []);

  const dismissToastWithReason = useCallback(
    (id: number, reason: ToastDismissReason) => {
      const toast = toastsRef.current.find((t) => t.id === id);
      if (!toast) return;

      const event = window.extensionContext.extensionRegistry.events.toast.dismissHandlers.emit(
        new ToastDismissEvent(id, Object.freeze({ ...toast }), reason),
      );
      if (event.cancelled) return;

      setToastList((prev) => prev.filter((t) => t.id !== id));
    },
    [setToastList],
  );

  const showToast = useCallback(
    (kind: ToastShowEvent['kind'], data: ToastShowData) => {
      const id = toastId.current++;

      const event = window.extensionContext.extensionRegistry.events.toast.showHandlers.emit(
        new ToastShowEvent(id, kind, data),
      );
      if (event.cancelled) return { id, shown: false };

      setToastList((prev) => [...prev, { ...event.data, id }]);

      return { id, shown: true };
    },
    [setToastList],
  );

  const addToast = useCallback(
    (message: ReactNode, typeOrActions?: ToastType | ToastAction[], maybeActions?: ToastAction[]) => {
      const type = Array.isArray(typeOrActions) ? 'success' : (typeOrActions ?? 'success');
      const actions = Array.isArray(typeOrActions) ? typeOrActions : maybeActions;

      const { id, shown } = showToast('toast', { message, type, actions, withCloseButton: true });

      if (shown) {
        setTimeout(() => dismissToastWithReason(id, 'timeout'), toastTimeout);
      }

      return id;
    },
    [showToast, dismissToastWithReason],
  );

  const addProgressToast = useCallback(
    (message: ReactNode, options?: ProgressToastOptions) =>
      showToast('progress', {
        message,
        type: options?.type ?? 'info',
        actions: options?.actions,
        progress: options?.progress ?? null,
        withCloseButton: options?.withCloseButton ?? false,
        onClose: options?.onClose,
      }).id,
    [showToast],
  );

  const updateToast = useCallback(
    (id: number, update: ToastUpdate) => {
      const current = toastsRef.current.find((t) => t.id === id);
      if (!current) return;

      const event = window.extensionContext.extensionRegistry.events.toast.updateHandlers.emit(
        new ToastUpdateEvent(id, Object.freeze({ ...current }), { ...update }),
      );
      if (event.cancelled) return;

      setToastList((prev) => {
        const index = prev.findIndex((t) => t.id === id);
        if (index === -1) return prev;

        const toast = prev[index];
        const message = event.data.message === undefined ? toast.message : event.data.message;
        const type = event.data.type ?? toast.type;
        const actions = event.data.actions ?? toast.actions;
        const progress = event.data.progress === undefined ? toast.progress : event.data.progress;

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
    },
    [setToastList],
  );

  const dismissToast = useCallback(
    (id: number) => dismissToastWithReason(id, 'programmatic'),
    [dismissToastWithReason],
  );

  const finishProgressToast = useCallback(
    (id: number, message: ReactNode, type: ToastType) => {
      updateToast(id, { message, type });

      setToastList((prev) => {
        const index = prev.findIndex((t) => t.id === id);
        if (index === -1) return prev;

        const next = [...prev];
        next[index] = { ...prev[index], progress: undefined, withCloseButton: true, onClose: undefined };

        return next;
      });

      setTimeout(() => dismissToastWithReason(id, 'timeout'), toastTimeout);
    },
    [updateToast, setToastList, dismissToastWithReason],
  );

  const addPendingToast = useCallback(
    (message: ReactNode): PendingToast => {
      let id: number | null = null;
      const timer = setTimeout(() => {
        id = addProgressToast(message);
      }, pendingToastDelay);

      return {
        settle: (finalMessage, type = 'success') => {
          clearTimeout(timer);

          const shownId = toastsRef.current.some((t) => t.id === id) ? id : null;

          if (finalMessage === undefined) {
            if (shownId !== null) dismissToast(shownId);
          } else if (shownId !== null) {
            finishProgressToast(shownId, finalMessage, type);
          } else {
            addToast(finalMessage, type);
          }
        },
      };
    },
    [addProgressToast, addToast, dismissToast, finishProgressToast],
  );

  const contextValue = useMemo(
    () => ({
      toastPosition,
      addToast,
      addProgressToast,
      updateToast,
      dismissToast,
      addPendingToast,
    }),
    [toastPosition, addToast, addProgressToast, updateToast, dismissToast, addPendingToast],
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className={classNames('fixed z-999 space-y-2', getToastPositionClasses(toastPosition))}>
        <LazyMotion features={loadMotionFeatures}>
          <AnimatePresence>
            {toasts.map((toast) => {
              const hasProgress = toast.progress !== undefined;

              return (
                <m.div
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
                      onClose={() => (toast.onClose ? toast.onClose() : dismissToastWithReason(toast.id, 'close'))}
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
                </m.div>
              );
            })}
          </AnimatePresence>
        </LazyMotion>
      </div>
    </ToastContext.Provider>
  );
};

export { useToast } from './contexts/toastContext.ts';
export { ToastProvider };
