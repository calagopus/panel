import classNames from 'classnames';
import { memo, useEffect, useRef, useState } from 'react';
import { formatDateTime, formatMilliseconds } from '@/lib/time.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import Tooltip from '../Tooltip.tsx';

interface EstimatedTimeArrivalProps {
  progress: number;
  total: number;
  className?: string;
  autoUpdate?: boolean;
}

function EstimatedTimeArrival({ progress, total, className, autoUpdate = true }: EstimatedTimeArrivalProps) {
  const { t } = useTranslations();
  const progressRef = useRef(progress);
  const [history, setHistory] = useState<{ t: number; p: number }[]>([]);
  const [hasStartedProgress, setHasStartedProgress] = useState(false);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    if (!autoUpdate || progress >= total) return;

    setHistory((prev) => (prev.length === 0 ? [{ t: Date.now(), p: progress }] : prev));

    const intervalId = setInterval(() => {
      const now = Date.now();
      setHistory((prev) => [...prev, { t: now, p: progressRef.current }].filter((entry) => now - entry.t <= 30_000));
    }, 1000);

    return () => clearInterval(intervalId);
  }, [autoUpdate, total, progress]);

  let remainingMs = Infinity;
  let targetDate: number | null = null;

  if (history.length > 1 && progress < total) {
    const oldest = history[0];
    const newest = history[history.length - 1];

    const deltaProgress = newest.p - oldest.p;
    const deltaTime = newest.t - oldest.t;

    if (deltaProgress > 0) {
      setHasStartedProgress(true);
    }

    if (deltaProgress > 0 && deltaTime > 0) {
      const msPerUnit = deltaTime / deltaProgress;
      remainingMs = msPerUnit * (total - newest.p);
      targetDate = Date.now() + remainingMs;
    }
  } else if (progress >= total) {
    remainingMs = 0;
    targetDate = Date.now();
  }

  const displayDuration =
    hasStartedProgress && isFinite(remainingMs)
      ? t('elements.estimatedTimeArrival.calculated', {
          time: formatMilliseconds(remainingMs),
        })
      : t('elements.estimatedTimeArrival.calculating', {});

  let tooltipLabel = t('elements.estimatedTimeArrival.tooltip.estimating', {});
  if (targetDate && hasStartedProgress && isFinite(remainingMs)) {
    tooltipLabel = t('elements.estimatedTimeArrival.tooltip.estimated', {
      time: formatDateTime(targetDate),
    });
  }

  return (
    <Tooltip label={tooltipLabel}>
      <span className={classNames('cursor-help', className)}>{displayDuration}</span>
    </Tooltip>
  );
}

export default memo(EstimatedTimeArrival);
