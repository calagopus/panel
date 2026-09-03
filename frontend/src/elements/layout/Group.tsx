import { GroupProps, Group as MantineGroup } from '@mantine/core';
import { forwardRef } from 'react';
import { makeComponentHookable } from 'shared';

const Group = forwardRef<HTMLDivElement, GroupProps>(({ ...rest }, ref) => {
  return <MantineGroup ref={ref} {...rest} />;
});

export default makeComponentHookable(Group);
