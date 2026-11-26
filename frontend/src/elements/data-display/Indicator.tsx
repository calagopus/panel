import classNames from 'classnames';
import { ReactNode } from 'react';
import CopyOnClick from '@/elements/CopyOnClick.tsx';
import Icon, { type IconLike } from '@/elements/data-display/Icon.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';

export default function Indicator({
  icon,
  label,
  copy,
  className,
  children,
}: {
  icon: IconLike;
  label: string;
  copy?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tooltip label={label} innerClassName='min-w-0 max-w-full'>
      {copy ? (
        <CopyOnClick
          content={copy}
          className={classNames('flex max-w-full items-center gap-1.5 hover:text-(--mantine-color-text)', className)}
        >
          <Icon icon={icon} size='sm' className='shrink-0' />
          <span className='sr-only'>{label}</span>
          {children}
        </CopyOnClick>
      ) : (
        <span className={classNames('flex items-center gap-1.5', className)}>
          <Icon icon={icon} size='sm' className='shrink-0' />
          <span className='sr-only'>{label}</span>
          {children}
        </span>
      )}
    </Tooltip>
  );
}
