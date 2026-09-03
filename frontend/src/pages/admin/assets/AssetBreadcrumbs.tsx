import { createSearchParams, NavLink } from 'react-router';
import Breadcrumbs from '@/elements/data-display/Breadcrumbs.tsx';
import { pathSegments } from '@/lib/path.ts';

const crumbClassName = 'text-(--mantine-color-anchor) hover:underline';

export default function AssetBreadcrumbs({ directory }: { directory: string }) {
  const crumbs = [{ name: 'assets', path: '' }, ...pathSegments(directory)];

  return (
    <Breadcrumbs separatorMargin='xs'>
      {crumbs.map((crumb) => (
        <NavLink
          key={crumb.path || 'root'}
          to={`?${createSearchParams({ directory: crumb.path })}`}
          className={crumbClassName}
        >
          {crumb.name}
        </NavLink>
      ))}
    </Breadcrumbs>
  );
}
