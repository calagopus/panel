import { Breadcrumbs } from '@mantine/core';
import { ReactNode } from 'react';
import { createSearchParams, NavLink } from 'react-router';

export default function AssetBreadcrumbs({ directory }: { directory: string }) {
  const segments = directory.split('/').filter(Boolean);
  const pathItems = segments.map((seg, i) => ({
    name: seg,
    path: segments.slice(0, i + 1).join('/'),
  }));

  const items: ReactNode[] = [
    <NavLink
      key='root'
      to={`?${createSearchParams({ directory: '' })}`}
      className='text-(--mantine-color-anchor) hover:underline'
    >
      assets
    </NavLink>,
    ...pathItems.map((item) => (
      <NavLink
        key={item.path}
        to={`?${createSearchParams({ directory: item.path })}`}
        className='text-(--mantine-color-anchor) hover:underline'
      >
        {item.name}
      </NavLink>
    )),
  ];

  return (
    <div
      id='asset-breadcrumbs-inner'
      className='flex flex-col gap-4 sm:gap-0 sm:flex-row sm:items-center sm:justify-between'
    >
      <Breadcrumbs separatorMargin='xs'>{items}</Breadcrumbs>
    </div>
  );
}
