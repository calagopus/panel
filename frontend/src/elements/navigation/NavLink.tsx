import { NavLink as MantineNavLink, NavLinkProps } from '@mantine/core';
import { forwardRef } from 'react';
import { makeComponentHookable } from 'shared';

const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(({ ...rest }, ref) => {
  return <MantineNavLink ref={ref} {...rest} />;
});

export default makeComponentHookable(NavLink);
