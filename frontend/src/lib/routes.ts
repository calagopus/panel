export const to = (value: string, base: string = '') => {
  if (value === '/' || value === '') {
    return base;
  }

  const clean = value
    .replace(/^\/+/, '') // remove leading slashes
    .replace(/\/\*$/, ''); // remove /*

  return `${base.replace(/\/+$/, '')}/${clean}`;
};

type RouteLike = { path: string; name?: unknown };
type RouteOrderLike = { type: string; path?: string };

const isUnderPath = (path: string, parent: string) => {
  if (parent === '/') return path === '/';
  return path === parent || path.startsWith(`${parent}/`);
};

/**
 * Computes the set of route paths that remain reachable once a custom sidebar
 * `routeOrder` is applied. Named routes (the ones an admin can reorder/remove)
 * are only accessible when present in the order; unnamed sub-routes inherit
 * accessibility from their nearest named parent, so removing e.g. "Files" also
 * blocks `/files/diff` and `/files/:action`. Returns `null` when no order is
 * configured, meaning every route stays accessible.
 */
export const getAccessibleRoutePaths = (
  routes: RouteLike[],
  routeOrder: RouteOrderLike[] | null | undefined,
): Set<string> | null => {
  if (!routeOrder) return null;

  const orderedPaths = new Set(
    routeOrder.filter((item) => item.type === 'route' && item.path).map((item) => item.path as string),
  );

  const namedPaths = routes.filter((route) => !!route.name).map((route) => route.path);
  const accessible = new Set<string>();

  for (const route of routes) {
    if (route.name) {
      if (orderedPaths.has(route.path)) accessible.add(route.path);
      continue;
    }

    let owner: string | null = null;
    for (const named of namedPaths) {
      if (isUnderPath(route.path, named) && (owner === null || named.length > owner.length)) {
        owner = named;
      }
    }

    if (owner === null || orderedPaths.has(owner)) accessible.add(route.path);
  }

  return accessible;
};
