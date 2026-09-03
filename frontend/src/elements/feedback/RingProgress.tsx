import { RingProgress as MantineRingProgress, RingProgressProps } from '@mantine/core';
import { forwardRef } from 'react';
import { makeComponentHookable } from 'shared';

const INDETERMINATE_ARC = 25;

const RingProgress = forwardRef<HTMLDivElement, RingProgressProps & { indeterminate?: boolean }>(
  ({ className, classNames, indeterminate = false, sections, ...rest }, ref) => {
    if (!indeterminate) {
      return (
        <MantineRingProgress ref={ref} className={className} classNames={classNames} sections={sections} {...rest} />
      );
    }

    const svg =
      typeof classNames === 'object' && classNames?.svg
        ? `${classNames.svg} animate-ring-indeterminate`
        : 'animate-ring-indeterminate';

    return (
      <MantineRingProgress
        ref={ref}
        className={className}
        classNames={typeof classNames === 'object' && classNames !== null ? { ...classNames, svg } : { svg }}
        sections={[{ value: INDETERMINATE_ARC, color: sections?.[0]?.color ?? 'blue' }]}
        {...rest}
      />
    );
  },
);

export default makeComponentHookable(RingProgress);
