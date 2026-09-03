import { BreadcrumbsProps, Breadcrumbs as MantineBreadcrumbs } from '@mantine/core';
import { forwardRef } from 'react';
import { makeComponentHookable } from 'shared';

const Breadcrumbs = forwardRef<HTMLDivElement, BreadcrumbsProps>(({ ...rest }, ref) => {
  return <MantineBreadcrumbs ref={ref} {...rest} />;
});

export default makeComponentHookable(Breadcrumbs);
