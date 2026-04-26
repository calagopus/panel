'use no memo';

import classNames from 'classnames';
import { memo, useEffect, useState } from 'react';
import { formatDateTime, formatTimestamp } from '@/lib/time.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import Tooltip from '../Tooltip.tsx';

interface FormattedTimestampProps {
  timestamp: string | number | Date;
  tooltipClassName?: string;
  tooltipInnerClassName?: string;
  className?: string;
  autoUpdate?: boolean;
  precise?: boolean;
  showNA?: boolean;
}

function FormattedTimestamp({
  timestamp,
  tooltipClassName,
  tooltipInnerClassName,
  className,
  autoUpdate = true,
  precise,
  showNA = false,
}: FormattedTimestampProps) {
  const { t } = useTranslations();

  const [, forceRender] = useState(0);

  useEffect(() => {
    if (!autoUpdate) return;

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

  if (showNA && (!timestamp || new Date(timestamp).getTime() === 0)) {
    return <span className={className}>{t('common.na', {})}</span>;
  }

  return (
    <Tooltip
      label={formatDateTime(timestamp, precise, false)}
      className={tooltipClassName}
      innerClassName={tooltipInnerClassName}
    >
      <span className={classNames('cursor-help', className)}>{formatTimestamp(timestamp)}</span>
    </Tooltip>
  );
}

export default memo(FormattedTimestamp);
