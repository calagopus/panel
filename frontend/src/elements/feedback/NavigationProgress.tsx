import { useIsFetching } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useActivityStore } from '@/stores/activity.ts';

const slowAfter = 500;
const handoffGrace = 150;
const visibleAfter = 150;

export default function NavigationProgress({ pending }: { pending: boolean }) {
  const fetching = useIsFetching({
    predicate: (query) =>
      query.state.data === undefined && query.getObserversCount() > 0 && query.meta?.progress !== false,
  });
  const tracked = useActivityStore((state) => state.pending);
  const busy = fetching > 0 || tracked > 0;

  const [slow, setSlow] = useState(false);
  const [handoff, setHandoff] = useState(false);
  const pendingSince = useRef<number | null>(null);

  useEffect(() => {
    if (!busy) {
      setSlow(false);
      return;
    }

    const timeout = setTimeout(() => setSlow(true), slowAfter);
    return () => clearTimeout(timeout);
  }, [busy]);

  useEffect(() => {
    if (pending) {
      pendingSince.current = Date.now();
      return;
    }
    if (pendingSince.current === null) return;
    const pendingFor = Date.now() - pendingSince.current;
    pendingSince.current = null;
    if (pendingFor < visibleAfter) return;

    setHandoff(true);
  }, [pending]);

  useEffect(() => {
    if (!handoff) return;

    const timeout = setTimeout(() => setHandoff(false), handoffGrace);
    return () => clearTimeout(timeout);
  }, [handoff]);

  useEffect(() => {
    if (handoff && busy) setSlow(true);
  }, [handoff, busy]);

  if (!pending && !handoff && !slow) return null;

  return (
    <div
      role='progressbar'
      aria-busy='true'
      className='fixed inset-x-0 top-0 z-1000 h-0.75 overflow-hidden pointer-events-none animate-fade-in motion-reduce:animate-none'
    >
      <div className='h-full w-2/5 bg-(--mantine-primary-color-filled) animate-progress-indeterminate motion-reduce:animate-none' />
    </div>
  );
}
