import { AnchorProps, ElementProps, Anchor as MantineAnchor } from '@mantine/core';
import { forwardRef } from 'react';
import { makeComponentHookable } from 'shared';

const Anchor = forwardRef<HTMLAnchorElement, AnchorProps & ElementProps<'a'>>(({ className, ...rest }, ref) => {
  return <MantineAnchor ref={ref} className={className} {...rest} />;
});

export default makeComponentHookable(Anchor);
