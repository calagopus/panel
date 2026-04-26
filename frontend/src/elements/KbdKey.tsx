import { IconDefinition } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import classNames from 'classnames';
import { makeComponentHookable } from 'shared';

interface KbdKeyProps {
  children: React.ReactNode;
  className?: string;
  icon?: IconDefinition;
}

function KbdKey({ children, className, icon }: KbdKeyProps) {
  return (
    <div
      className={classNames(
        'inline-flex items-center justify-center w-11 h-8 bg-linear-to-b from-(--mantine-color-dark-5) to-(--mantine-color-dark-6) border border-(--mantine-color-dark-4) rounded-md shadow-[0_2px_0_var(--mantine-color-dark-7),inset_0_1px_0_rgba(255,255,255,0.05)] text-xs font-semibold font-sans text-(--mantine-color-gray-3) uppercase tracking-[0.02em]',
        className,
      )}
    >
      {icon ? <FontAwesomeIcon icon={icon} size='sm' /> : children}
    </div>
  );
}

export default makeComponentHookable(KbdKey);
