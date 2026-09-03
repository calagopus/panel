import {
  Popover as MantinePopover,
  PopoverDropdown as MantinePopoverDropdown,
  PopoverTarget as MantinePopoverTarget,
  PopoverDropdownProps,
  PopoverProps,
  PopoverTargetProps,
} from '@mantine/core';
import { forwardRef } from 'react';
import { makeComponentHookable } from 'shared';

const PopoverTarget = forwardRef<HTMLDivElement, PopoverTargetProps>(({ ...rest }, ref) => {
  return <MantinePopoverTarget ref={ref} {...rest} />;
});

const PopoverDropdown = forwardRef<HTMLDivElement, PopoverDropdownProps>(({ ...rest }, ref) => {
  return <MantinePopoverDropdown ref={ref} {...rest} />;
});

const Popover = makeComponentHookable(
  ({ ...rest }: PopoverProps) => {
    return <MantinePopover {...rest} />;
  },
  {
    Target: makeComponentHookable(PopoverTarget),
    Dropdown: makeComponentHookable(PopoverDropdown),
  },
);

export default Popover;
