import classNames from 'classnames';
import { memo, useEffect, useState } from 'react';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import { formatDateTime, formatTimestamp } from '@/lib/format/time.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

interface FormattedTimestampProps {
  timestamp: string | number | Date | null | undefined;
  tooltipClassName?: string;
  tooltipInnerClassName?: string;
  className?: string;
  autoUpdate?: boolean;
  precise?: boolean;
  showNA?: boolean;
  withTooltip?: boolean;
}

function FormattedTimestamp({
  timestamp,
  tooltipClassName,
  tooltipInnerClassName,
  className,
  autoUpdate = true,
  precise,
  showNA = false,
  withTooltip = true,
}: FormattedTimestampProps) {
  // formatTimestamp() reads the current time, so its result cannot be cached on `timestamp` alone;
  // the compiler would otherwise freeze the relative label at whatever it rendered first.
  'use no memo';

  const { t } = useTranslations();

  const [, forceRender] = useState(0);

  useEffect(() => {
    if (!autoUpdate || timestamp == null) return;

    let timeoutId: ReturnType<typeof setTimeout>;
    const targetTime = new Date(timestamp).getTime();

    const scheduleNextUpdate = () => {
      const diffMs = Date.now() - targetTime;

      if (diffMs < 60_000) {
        timeoutId = setTimeout(() => {
          forceRender((prev) => prev + 1);
          scheduleNextUpdate();
        }, 1000);
      } else if (diffMs < 3_600_000) {
        timeoutId = setTimeout(() => {
          forceRender((prev) => prev + 1);
          scheduleNextUpdate();
        }, 60_000);
      }
    };

    scheduleNextUpdate();

    return () => clearTimeout(timeoutId);
  }, [timestamp, autoUpdate]);

  if (timestamp == null || (showNA && (!timestamp || new Date(timestamp).getTime() === 0))) {
    return <span className={className}>{t('common.na', {})}</span>;
  }

  const formatted = (
    <span className={classNames(withTooltip && 'cursor-help', className)}>{formatTimestamp(timestamp)}</span>
  );

  return withTooltip ? (
    <Tooltip
      label={formatDateTime(timestamp, precise, false)}
      className={tooltipClassName}
      innerClassName={tooltipInnerClassName}
    >
      {formatted}
    </Tooltip>
  ) : (
    formatted
  );
}

export default memo(FormattedTimestamp);
