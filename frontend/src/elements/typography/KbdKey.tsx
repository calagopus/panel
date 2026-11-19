import classNames from 'classnames';
import { makeComponentHookable } from 'shared';
import Icon, { type IconLike } from '@/elements/data-display/Icon.tsx';

interface KbdKeyProps {
  children: React.ReactNode;
  className?: string;
  icon?: IconLike;
}

function KbdKey({ children, className, icon }: KbdKeyProps) {
  return (
    <div
      className={classNames(
        'inline-flex items-center justify-center w-11 h-8 bg-linear-to-b from-(--mantine-color-default-hover) to-(--mantine-color-default) border border-(--mantine-color-default-border) rounded-md shadow-[0_2px_0_var(--mantine-color-default-border),inset_0_1px_0_rgba(255,255,255,0.05)] text-xs font-semibold font-sans text-(--mantine-color-text) uppercase tracking-[0.02em]',
        className,
      )}
    >
      {icon ? <Icon icon={icon} size='sm' /> : children}
    </div>
  );
}

export default makeComponentHookable(KbdKey);
