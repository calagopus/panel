import classNames from 'classnames';
import { ComponentProps } from 'react';
import { NavLink } from 'react-router';

export default function TableLink({ className, children, ...rest }: ComponentProps<typeof NavLink>) {
  return (
    <NavLink
      className={classNames(
        'text-blue-400 hover:text-blue-200 hover:underline light:text-blue-700 light:hover:text-blue-900',
        className,
      )}
      {...rest}
    >
      {children}
    </NavLink>
  );
}
