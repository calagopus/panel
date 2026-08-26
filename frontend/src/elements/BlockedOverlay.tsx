import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faBan } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { MantineColor } from '@mantine/core';
import classNames from 'classnames';
import { forwardRef, ReactNode } from 'react';
import { makeComponentHookable } from 'shared';

export interface BlockedOverlayProps {
  visible: boolean;
  title: ReactNode;
  description?: ReactNode;
  icon?: IconDefinition;
  color?: MantineColor;
  className?: string;
}

const BlockedOverlay = forwardRef<HTMLDivElement, BlockedOverlayProps>(
  ({ visible, title, description, icon = faBan, color = 'red', className }, ref) => {
    if (!visible) return null;

    return (
      <div
        ref={ref}
        className={classNames(
          'absolute inset-0 z-30 flex items-center justify-center p-3 pointer-events-none select-none',
          'rounded-[inherit] backdrop-blur-md',
          'border-2 border-dashed',
          className,
        )}
        style={{
          borderColor: `var(--mantine-color-${color}-filled)`,
          backgroundColor: 'color-mix(in srgb, var(--mantine-color-body) 95%, transparent)',
        }}
      >
        <div className='flex flex-row items-center gap-3 min-w-0 rounded-lg px-4 py-3 bg-(--mantine-color-default) border border-(--mantine-color-default-border) shadow-xl'>
          <FontAwesomeIcon
            icon={icon}
            className='text-2xl shrink-0'
            style={{ color: `var(--mantine-color-${color}-filled)` }}
          />
          <div className='flex flex-col min-w-0'>
            <div className='font-semibold leading-tight'>{title}</div>
            {description && (
              <div className='text-sm text-(--mantine-color-dimmed) leading-tight mt-1'>{description}</div>
            )}
          </div>
        </div>
      </div>
    );
  },
);

export default makeComponentHookable(BlockedOverlay);
