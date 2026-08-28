import classNames from 'classnames';
import { memo, useEffect, useRef, useState } from 'react';
import { formatDateTime, formatMilliseconds } from '@/lib/time.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import Tooltip from '../Tooltip.tsx';

interface EstimatedTimeArrivalProps {
  progress?: number;
  total?: number;
  className?: string;
  autoUpdate?: boolean;
}

interface Sample {
  time: number;
  progress: number;
}

function EstimatedTimeArrival({ progress = 0, total = 0, className, autoUpdate = true }: EstimatedTimeArrivalProps) {
  const { t } = useTranslations();
  const progressRef = useRef(progress);
  const totalRef = useRef(total);
  const samplesRef = useRef<Sample[]>([]);
  const [estimate, setEstimate] = useState<{ remainingMs: number; targetDate: number } | null>(null);

  useEffect(() => {
    progressRef.current = progress;
    totalRef.current = total;
  }, [progress, total]);

  const isComplete = total > 0 && progress >= total;

  useEffect(() => {
    if (!autoUpdate || isComplete) return;

    samplesRef.current = [{ time: Date.now(), progress: progressRef.current }];

    const intervalId = setInterval(() => {
      const now = Date.now();
      const currentProgress = progressRef.current;
      const currentTotal = totalRef.current;
      const samples = samplesRef.current;
      const lastSample = samples[samples.length - 1];

      if (lastSample && currentProgress < lastSample.progress) {
        samplesRef.current = [{ time: now, progress: currentProgress }];
        setEstimate(null);
        return;
      }

      samples.push({ time: now, progress: currentProgress });
      const cutoff = now - 30_000;
      while (samples.length > 2 && samples[0].time < cutoff) {
        samples.shift();
      }

      if (samples.length >= 2 && currentTotal > 0) {
        const oldestSample = samples[0];
        const newestSample = samples[samples.length - 1];
        const deltaProgress = newestSample.progress - oldestSample.progress;
        const deltaTime = newestSample.time - oldestSample.time;

        if (deltaProgress > 0 && deltaTime > 0) {
          const remainingMs = Math.max(0, ((currentTotal - currentProgress) * deltaTime) / deltaProgress);
          setEstimate({ remainingMs, targetDate: now + remainingMs });
          return;
        }
      }

      setEstimate((prev) =>
        prev ? { remainingMs: Math.max(0, prev.targetDate - now), targetDate: prev.targetDate } : null,
      );
    }, 1000);

    return () => clearInterval(intervalId);
  }, [autoUpdate, isComplete]);

  const active = isComplete ? { remainingMs: 0, targetDate: Date.now() } : estimate;

  const tooltipLabel = active?.targetDate
    ? t('elements.estimatedTimeArrival.tooltip.estimated', { time: formatDateTime(active.targetDate) })
    : t('elements.estimatedTimeArrival.tooltip.estimating', {});

  const displayDuration = active
    ? t('elements.estimatedTimeArrival.calculated', { time: formatMilliseconds(active.remainingMs) })
    : t('elements.estimatedTimeArrival.calculating', {});

  return (
    <Tooltip label={tooltipLabel}>
      <span className={classNames('cursor-help', className)}>{displayDuration}</span>
    </Tooltip>
  );
}

export default memo(EstimatedTimeArrival);
