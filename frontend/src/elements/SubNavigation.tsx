import { IconDefinition } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Tabs } from '@mantine/core';
import React, { createContext, ReactNode, useContext, useMemo } from 'react';
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router';
import { HookableComponentBase, makeComponentHookable } from 'shared';
import { SubNavigationRegistry } from 'shared/src/registries/slices/subNavigation.ts';
import { pageNavigationCategoryId } from '@/lib/coreQuickActions.tsx';
import { type LazyString, resolveString } from '@/lib/lazy.ts';
import { to } from '@/lib/routes.ts';
import { useAdminPermissions } from '@/plugins/usePermissions.ts';
import { useQuickActions } from '@/plugins/useQuickActions.ts';
import AdminPermissionGuard from '@/routers/guards/AdminPermissionGuard.tsx';

interface BaseItemProp {
  name: LazyString;
  icon: IconDefinition;
  hidden?: boolean;
  permission?: string;
  end?: boolean;
}

interface RouteItem extends BaseItemProp {
  path: string;
  element: ReactNode;
  link?: never;
}

interface LinkItem extends BaseItemProp {
  link: string;
  path?: never;
  element?: never;
}

export type ItemProp = RouteItem | LinkItem;

type SubNavigationProps<P = unknown> = {
  baseUrl: string;
  items: ItemProp[];
  hideWhenSingle?: boolean;
} & ({ registry: SubNavigationRegistry<P>; registryProps: P } | { registry?: never; registryProps?: never });

function useVisibleItems(items: ItemProp[]): ItemProp[] {
  const permissionMatrix = useAdminPermissions(items.flatMap((item) => item.permission ?? []));

  let permissionIndex = 0;
  const result: ItemProp[] = [];

  for (const item of items) {
    const canAccess = item.permission === undefined || permissionMatrix[permissionIndex++];
    if (canAccess && !item.hidden) result.push(item);
  }

  return result;
}

const itemPath = (baseUrl: string, item: ItemProp) => item.link ?? to(item.path, baseUrl);

const SubNavigationDepthContext = createContext(0);

function useSubNavigationQuickActions(baseUrl: string, items: ItemProp[], enabled: boolean, depth: number) {
  const navigate = useNavigate();
  const base = baseUrl.replace(/\/+$/, '');

  useQuickActions(
    items.map((item) => {
      const path = itemPath(baseUrl, item);

      return {
        id: `subNavigation:${path}`,
        category: pageNavigationCategoryId(depth),
        label: item.name,
        path: path.startsWith(base) ? path.slice(base.length) || '/' : path,
        icon: <FontAwesomeIcon icon={item.icon} />,
        perform: () => navigate(path),
      };
    }),
    enabled,
  );
}

function SubNavigationItem({ baseUrl, item }: { baseUrl: string; item: ItemProp }) {
  return (
    <NavLink key={resolveString(item.name)} to={itemPath(baseUrl, item)} end={item.end ?? true}>
      <Tabs.Tab
        key={resolveString(item.name)}
        value={resolveString(item.name)}
        leftSection={<FontAwesomeIcon icon={item.icon} />}
      >
        {resolveString(item.name)}
      </Tabs.Tab>
    </NavLink>
  );
}

function SubNavigation<P>({
  baseUrl,
  items: baseItems,
  hideWhenSingle,
  registry,
  registryProps,
}: SubNavigationProps<P>) {
  const location = useLocation();
  const depth = useContext(SubNavigationDepthContext) + 1;

  const items = useMemo(() => {
    const items = [...baseItems];

    if (registry) {
      for (const interceptor of registry.itemInterceptors) {
        interceptor(items, registryProps);
      }
    }

    return items;
  }, [baseItems, registry, registryProps]);

  const visibleItems = useVisibleItems(items);
  const tabsShown = !hideWhenSingle || visibleItems.length > 1;
  const pathItems = items.filter((item) => item.path);

  useSubNavigationQuickActions(baseUrl, visibleItems, tabsShown, depth);

  const activeItem =
    items
      .filter((item) => {
        if (item.path) {
          if (item.path.includes('*')) {
            const segments = item.path.split('/').filter(Boolean);
            const locationSegments = location.pathname.replace(baseUrl, '').split('/').filter(Boolean);
            for (let i = 0; i < segments.length - 1; i++) {
              if (segments[i] !== locationSegments[i]) {
                return false;
              }
            }
            return true;
          }
          return location.pathname.endsWith(item.path);
        }
        if (item.link) return item.link === '/' ? location.pathname === '/' : location.pathname.endsWith(item.link);
        return false;
      })
      .sort((a, b) => (b.path?.length ?? b.link?.length ?? 0) - (a.path?.length ?? a.link?.length ?? 0))[0] ?? items[0];

  return (
    <SubNavigationDepthContext.Provider value={depth}>
      {tabsShown && (
        <Tabs my='xs' value={resolveString(activeItem?.name) ?? resolveString(items[0].name)}>
          <Tabs.List>
            {visibleItems.map((item) => (
              <SubNavigationItem key={resolveString(item.name)} baseUrl={baseUrl} item={item} />
            ))}
          </Tabs.List>
        </Tabs>
      )}
      {pathItems.length > 0 && (
        <Routes>
          {pathItems.map((item) => (
            <Route key={item.path} element={<AdminPermissionGuard permission={item.permission ?? []} />}>
              <Route path={item.path} element={item.element} />
            </Route>
          ))}
        </Routes>
      )}
    </SubNavigationDepthContext.Provider>
  );
}

export default makeComponentHookable(SubNavigation) as typeof SubNavigation &
  HookableComponentBase<React.ComponentProps<typeof SubNavigation>>;
