import {
  Menu as MantineMenu,
  MenuDivider as MantineMenuDivider,
  MenuDropdown as MantineMenuDropdown,
  MenuItem as MantineMenuItem,
  MenuLabel as MantineMenuLabel,
  MenuTarget as MantineMenuTarget,
  MenuDividerProps,
  MenuDropdownProps,
  MenuItemProps,
  MenuLabelProps,
  MenuProps,
  MenuTargetProps,
} from '@mantine/core';
import { ComponentPropsWithoutRef, forwardRef } from 'react';
import { makeComponentHookable } from 'shared';

const MenuTarget = ({ ...rest }: MenuTargetProps) => {
  return <MantineMenuTarget {...rest} />;
};

const MenuDropdown = forwardRef<HTMLDivElement, MenuDropdownProps>(({ ...rest }, ref) => {
  return <MantineMenuDropdown ref={ref} {...rest} />;
});

const MenuDivider = forwardRef<HTMLDivElement, MenuDividerProps>(({ ...rest }, ref) => {
  return <MantineMenuDivider ref={ref} {...rest} />;
});

const MenuLabel = forwardRef<HTMLDivElement, MenuLabelProps>(({ ...rest }, ref) => {
  return <MantineMenuLabel ref={ref} {...rest} />;
});

const MenuItem = forwardRef<HTMLButtonElement, MenuItemProps & ComponentPropsWithoutRef<'button'>>(
  ({ ...rest }, ref) => {
    return <MantineMenuItem ref={ref} {...rest} />;
  },
);

const Menu = makeComponentHookable(
  ({ ...rest }: MenuProps) => {
    return <MantineMenu {...rest} />;
  },
  {
    Target: makeComponentHookable(MenuTarget),
    Dropdown: makeComponentHookable(MenuDropdown),
    Divider: makeComponentHookable(MenuDivider),
    Label: makeComponentHookable(MenuLabel),
    Item: makeComponentHookable(MenuItem),
  },
);

export default Menu;
