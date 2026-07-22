import { MantineColor, Progress as MantineProgress, ProgressRootProps } from '@mantine/core';
import classNames from 'classnames';
import { makeComponentHookable } from 'shared';
import AnimatedHourglass from './AnimatedHourglass.tsx';

function Progress({
  value = 0,
  color = 'blue',
  indeterminate = false,
  className,
  hourglass = true,
  ...rest
}: ProgressRootProps & { value?: number; color?: MantineColor; indeterminate?: boolean; hourglass?: boolean }) {
  const isIndeterminate = indeterminate || !Number.isFinite(value);
  const clamped = isIndeterminate ? 0 : Math.min(100, Math.max(0, value));
  const label = clamped >= 100 ? '100%' : `${clamped.toFixed(1)}%`;

  return (
    <div className={classNames('flex flex-row items-center', className)}>
      {hourglass && (
        <span className='mr-2'>
          <AnimatedHourglass />
        </span>
      )}

      <MantineProgress.Root size='xl' className='grow' {...rest}>
        {isIndeterminate ? (
          <MantineProgress.Section
            value={40}
            color={color}
            withAria={false}
            className='rounded-full animate-progress-indeterminate'
          />
        ) : (
          <>
            <MantineProgress.Section value={clamped} color={color} />
            <span className='absolute inset-0 flex items-center justify-center pointer-events-none text-[11px] leading-none font-semibold tabular-nums text-(--mantine-color-text)'>
              {label}
            </span>
            <span
              className='absolute inset-0 flex items-center justify-center pointer-events-none text-[11px] leading-none font-semibold tabular-nums text-white'
              style={{
                clipPath: `inset(0 ${100 - clamped}% 0 0)`,
                transition: 'clip-path var(--progress-transition-duration, 100ms) ease',
              }}
            >
              {label}
            </span>
          </>
        )}
      </MantineProgress.Root>
    </div>
  );
}

export default makeComponentHookable(Progress);
