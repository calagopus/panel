import { CollapseProps, Collapse as MantineCollapse } from '@mantine/core';
import { forwardRef } from 'react';
import { makeComponentHookable } from 'shared';

const Collapse = forwardRef<HTMLDivElement, CollapseProps>(({ ...rest }, ref) => {
  return <MantineCollapse ref={ref} {...rest} />;
});

export default makeComponentHookable(Collapse);
