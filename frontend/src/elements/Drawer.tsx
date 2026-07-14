import { DrawerProps, Drawer as MantineDrawer } from '@mantine/core';
import { forwardRef } from 'react';
import { makeComponentHookable } from 'shared';

const Drawer = forwardRef<HTMLDivElement, DrawerProps>(({ children, className, ...rest }, ref) => {
  return (
    <MantineDrawer
      overlayProps={{
        backgroundOpacity: 0.55,
        blur: 3,
      }}
      removeScrollProps={{ removeScrollBar: false }}
      ref={ref}
      className={className}
      {...rest}
    >
      {children}
    </MantineDrawer>
  );
});

export default makeComponentHookable(Drawer);
