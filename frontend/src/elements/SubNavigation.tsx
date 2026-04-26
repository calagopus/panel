import { IconDefinition } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Tabs } from '@mantine/core';
import React, { ReactNode, useMemo } from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router';
import { HookableComponentBase, makeComponentHookable } from 'shared';
import { SubNavigationRegistry } from 'shared/src/registries/slices/subNavigation.ts';
import { to } from '@/lib/routes.ts';
import { useAdminPermissions, useCan } from '@/plugins/usePermissions.ts';
import AdminPermissionGuard from '@/routers/guards/AdminPermissionGuard.tsx';

interface BaseItemProp {
  name: string | (() => string);
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
} & ({ registry: SubNavigationRegistry<P>; registryProps: P } | { registry?: never; registryProps?: never });

function SubNavigationItem({ baseUrl, item }: { baseUrl: string; item: ItemProp }) {
  const permissionMatrix = useAdminPermissions(item.permission ?? []);
  const canAccess = useCan(permissionMatrix, true);

  if (item.permission && !canAccess) return null;
  if (item.hidden) return null;

  return (
    <NavLink
      key={typeof item.name === 'string' ? item.name : item.name()}
      to={item.link ?? to(item.path, baseUrl)}
      end={item.end ?? true}
    >
      <Tabs.Tab
        key={typeof item.name === 'string' ? item.name : item.name()}
        value={typeof item.name === 'string' ? item.name : item.name()}
        leftSection={<FontAwesomeIcon icon={item.icon} />}
      >
        {typeof item.name === 'string' ? item.name : item.name()}
      </Tabs.Tab>
    </NavLink>
  );
}

function SubNavigation<P>({ baseUrl, items: baseItems, registry, registryProps }: SubNavigationProps<P>) {
  const location = useLocation();

  const items = useMemo(() => {
    const items = [...baseItems];

    if (registry) {
      for (const interceptor of registry.itemInterceptors) {
        interceptor(items, registryProps);
      }
    }

    return items;
  }, [baseItems, registry, registryProps]);

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
    <>
      <Tabs
        my='xs'
        value={
          typeof activeItem?.name === 'string'
            ? activeItem?.name
            : (activeItem?.name() ?? (typeof items[0].name === 'string' ? items[0].name : items[0].name()))
        }
      >
        <Tabs.List>
          {items.map((item) => (
            <SubNavigationItem
              key={typeof item.name === 'string' ? item.name : item.name()}
              baseUrl={baseUrl}
              item={item}
            />
          ))}
        </Tabs.List>
      </Tabs>
      <Routes>
        {items
          .filter((item) => item.path)
          .map((item) => (
            <Route key={item.path} element={<AdminPermissionGuard permission={item.permission ?? []} />}>
              <Route path={item.path} element={item.element} />
            </Route>
          ))}
      </Routes>
    </>
  );
}

export default makeComponentHookable(SubNavigation) as typeof SubNavigation &
  HookableComponentBase<React.ComponentProps<typeof SubNavigation>>;
