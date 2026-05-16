import { Transition } from 'history';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useHistory } from '@/providers/contexts/historyContext.ts';

export type BlockerState = 'idle' | 'blocked' | 'proceeding';

export interface CustomBlocker {
  state: BlockerState;
  reset: () => void;
  proceed: () => void;
}

export function useBlocker(
  when: boolean,
  ignoreQueryChanges: boolean = false,
  shouldBlock?: (transition: Transition) => boolean,
): CustomBlocker {
  const history = useHistory();
  const [state, setState] = useState<BlockerState>('idle');

  const txRef = useRef<Transition | null>(null);
  const unblockRef = useRef<(() => void) | null>(null);
  const shouldBlockRef = useRef(shouldBlock);
  shouldBlockRef.current = shouldBlock;

  useEffect(() => {
    if (!when || !history) {
      setState('idle');
      return;
    }

    let unblock: () => void;

    const handleBlock = (transition: Transition) => {
      if (ignoreQueryChanges && history.location.pathname === transition.location.pathname) {
        unblock();
        transition.retry();

        unblock = history.block(handleBlock);
        unblockRef.current = unblock;
        return;
      }

      if (shouldBlockRef.current && !shouldBlockRef.current(transition)) {
        unblock();
        transition.retry();

        unblock = history.block(handleBlock);
        unblockRef.current = unblock;
        return;
      }

      txRef.current = transition;
      unblockRef.current = unblock;
      setState('blocked');
    };

    unblock = history.block(handleBlock);
    unblockRef.current = unblock;

    return () => {
      if (unblockRef.current) {
        unblockRef.current();
      }
    };
  }, [history, when, ignoreQueryChanges]);

  const proceed = useCallback(() => {
    if (txRef.current && unblockRef.current) {
      setState('proceeding');

      unblockRef.current();
      txRef.current.retry();

      txRef.current = null;
      unblockRef.current = null;
      setState('idle');
    }
  }, []);

  const reset = useCallback(() => {
    txRef.current = null;
    setState('idle');
  }, []);

  return { state, reset, proceed };
}
