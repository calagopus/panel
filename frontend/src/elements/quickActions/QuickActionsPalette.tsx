import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Combobox, useCombobox } from '@mantine/core';
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import type { AdminRouteDefinition, RouteDefinition, ServerRouteDefinition } from 'shared';
import { z } from 'zod';
import getServers from '@/api/server/getServers.ts';
import Group from '@/elements/Group.tsx';
import Kbd from '@/elements/Kbd.tsx';
import { Modal } from '@/elements/modals/Modal.tsx';
import Spinner from '@/elements/Spinner.tsx';
import Text from '@/elements/Text.tsx';
import { useLogoutConfirmation } from '@/elements/useLogoutConfirmation.tsx';
import { resolveString } from '@/lib/lazy.ts';
import { isAdmin } from '@/lib/permissions.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import {
  buildCoreQuickActionCategories,
  buildServerQuickActionItem,
  CORE_QUICK_ACTION_CATEGORIES,
  useCoreQuickActionDefinitions,
  useCoreQuickActionModes,
  useServerQuickActionTarget,
} from '@/lib/quickActions/coreQuickActions.tsx';
import type { QuickActionCategory, QuickActionItem, QuickActionScope } from '@/lib/quickActions/quickActions.ts';
import { getAccessibleRoutePaths, to } from '@/lib/routes.ts';
import { serverSchema } from '@/lib/schemas/server/server.ts';
import { useKeyboardShortcuts } from '@/plugins/useKeyboardShortcuts.ts';
import { checkPermissions } from '@/plugins/usePermissions.ts';
import { useQuickActionLocation } from '@/plugins/useQuickActions.ts';
import { useSearchableResource } from '@/plugins/useSearchableResource.ts';
import { useServerListShowOthers } from '@/plugins/useServerListShowOthers.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import { useQuickActionsStore } from '@/stores/quickActions.ts';
import { useServerStore } from '@/stores/server.ts';

const DEFAULT_CATEGORY_ORDER = 100;

const loadScopeRoutes = (scope: QuickActionScope) =>
  scope === 'admin'
    ? import('@/routers/routes/adminRoutes.ts')
    : scope === 'server'
      ? import('@/routers/routes/serverRoutes.ts')
      : import('@/routers/routes/accountRoutes.ts');

/**
 * Route modules pull in every page component they route to, so importing them eagerly would drag
 * the whole admin and server areas into the palette's chunk. The router for the current scope has
 * already loaded the one we need, making this resolve from cache.
 */
function useScopeRoutes(scope: QuickActionScope, enabled: boolean) {
  const [routes, setRoutes] = useState<RouteDefinition[] | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    loadScopeRoutes(scope)
      .then((module) => {
        if (!cancelled) setRoutes(module.default);
      })
      .catch(console.error);

    return () => {
      cancelled = true;
    };
  }, [scope, enabled]);

  return routes;
}

export default function QuickActionsPalette() {
  const { user } = useAuth();
  const setOpen = useQuickActionsStore((state) => state.setOpen);

  useEffect(() => {
    if (!user) setOpen(false);
  }, [user]);

  if (!user) return null;

  return <Palette />;
}

function Palette() {
  const { t } = useTranslations();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { confirmLogout, logoutModal } = useLogoutConfirmation();

  const open = useQuickActionsStore((state) => state.open);
  const setOpen = useQuickActionsStore((state) => state.setOpen);
  const query = useQuickActionsStore((state) => state.query);
  const setQuery = useQuickActionsStore((state) => state.setQuery);
  const actionProviders = useQuickActionsStore((state) => state.actions);
  const modeProviders = useQuickActionsStore((state) => state.modes);
  // Subscribed purely to repaint when a provider's host re-renders; providers are read lazily below.
  useQuickActionsStore((state) => state.revision);
  const userRouteOrder = useGlobalStore((state) => state.settings.user?.routeOrder);
  const [showOthers] = useServerListShowOthers();

  useKeyboardShortcuts({
    shortcuts: [{ id: 'general.quickActions', callback: () => setOpen(true) }],
  });

  const combobox = useCombobox();
  const comboboxRef = useRef(combobox);

  useEffect(() => {
    comboboxRef.current = combobox;
  });

  const server = useServerStore((state) => state.server);
  const { scope, serverId } = useQuickActionLocation();

  useEffect(() => {
    if (open) {
      comboboxRef.current.openDropdown();
    } else {
      setQuery('');
    }
  }, [open]);

  const servers = useSearchableResource<z.infer<typeof serverSchema>>({
    queryKey: [...queryKeys.user.servers.all(), { showOthers }],
    fetcher: (search) => getServers(1, search, showOthers),
    canRequest: open && scope === 'dashboard',
  });

  const close = () => setOpen(false);
  const serverTarget = useServerQuickActionTarget();
  const coreDefinitions = useCoreQuickActionDefinitions(confirmLogout);
  const scopeRoutes = useScopeRoutes(scope, open);

  const coreModes = useCoreQuickActionModes();
  const modes = useMemo(
    () => [
      ...coreModes,
      ...modeProviders.flatMap((provider) => provider()),
      ...window.extensionContext.extensionRegistry.quickActions.modes,
    ],
    [coreModes, modeProviders],
  );
  const mode = useMemo(() => modes.find((m) => query.startsWith(m.prefix)), [modes, query]);

  useEffect(() => {
    if (!mode) servers.setSearch(query);
  }, [query]);

  const normalizedQuery = query.trim().toLowerCase();

  const serverPermissions = useMemo(
    () => (scope === 'server' ? [...(server?.permissions || []), ...(user?.role?.serverPermissions || [])] : []),
    [scope, server?.permissions, user?.role?.serverPermissions],
  );

  const canServer = useCallback(
    (action: string | string[], matchAny = true) => {
      if (serverPermissions.includes('*')) return true;
      const matrix = checkPermissions(serverPermissions, action);
      return matchAny ? matrix.some(Boolean) : matrix.every(Boolean);
    },
    [serverPermissions],
  );

  const canAdminRoute = useCallback(
    (permission?: string | string[] | null) => {
      if (!permission) return true;
      if (user?.admin) return true;
      return checkPermissions(user?.role?.adminPermissions ?? [], permission).some(Boolean);
    },
    [user?.admin, user?.role?.adminPermissions],
  );

  const actionItems: QuickActionItem[] = useMemo(
    () =>
      [
        ...coreDefinitions,
        ...actionProviders.flatMap((provider) => provider()),
        ...window.extensionContext.extensionRegistry.quickActions.definitions,
      ]
        .filter((definition) => !definition.scopes || definition.scopes.includes(scope))
        .filter((definition) => !definition.permission || canServer(definition.permission))
        .filter(
          (definition) =>
            definition.adminPermission === undefined ||
            isAdmin(user, definition.adminPermission === true ? undefined : definition.adminPermission),
        )
        .filter((definition) => !definition.isVisible || definition.isVisible())
        .map((definition) => ({
          key: `action:${definition.id}`,
          category: definition.category,
          label: resolveString(definition.label),
          description: resolveString(definition.description),
          content: definition.content,
          path: definition.path,
          keywords: definition.keywords,
          icon: definition.icon,
          danger: definition.danger,
          onSelect: () => {
            setOpen(false);
            definition.perform();
          },
        })),
    [coreDefinitions, actionProviders, scope, user, canServer, setOpen],
  );

  const navItems: QuickActionItem[] = useMemo(() => {
    if (scope === 'dashboard') {
      const routes = [...(scopeRoutes ?? []), ...window.extensionContext.extensionRegistry.routes.accountRoutes];
      for (const interceptor of window.extensionContext.extensionRegistry.routes.accountRouteInterceptors) {
        interceptor(routes);
      }

      const accessibleRoutePaths = getAccessibleRoutePaths(routes, userRouteOrder);

      return routes
        .filter((route) => route.name && (!route.filter || route.filter()))
        .filter((route) => !accessibleRoutePaths || accessibleRoutePaths.has(route.path))
        .map((route) => {
          const path = to(route.path, '/account');

          return {
            key: `nav:${route.path}`,
            category: CORE_QUICK_ACTION_CATEGORIES.navigation,
            label: resolveString(route.name)!,
            path,
            icon: route.icon ? <FontAwesomeIcon icon={route.icon} /> : undefined,
            onSelect: () => {
              setOpen(false);
              navigate(path);
            },
          };
        });
    } else if (serverId) {
      const routes = [
        ...((scopeRoutes ?? []) as ServerRouteDefinition[]),
        ...window.extensionContext.extensionRegistry.routes.serverRoutes,
      ];
      for (const interceptor of window.extensionContext.extensionRegistry.routes.serverRouteInterceptors) {
        interceptor(routes);
      }

      const accessibleRoutePaths = getAccessibleRoutePaths(routes, server?.eggConfiguration?.routeOrder);

      return routes
        .filter((route) => route.name && (!route.filter || route.filter()))
        .filter((route) => !route.permission || canServer(route.permission))
        .filter((route) => !accessibleRoutePaths || accessibleRoutePaths.has(route.path))
        .map((route) => {
          const path = to(route.path, `/server/${serverId}`);

          return {
            key: `nav:${route.path}`,
            category: CORE_QUICK_ACTION_CATEGORIES.navigation,
            label: resolveString(route.name)!,
            path,
            icon: route.icon ? <FontAwesomeIcon icon={route.icon} /> : undefined,
            onSelect: () => {
              setOpen(false);
              navigate(path);
            },
          };
        });
    } else if (scope === 'admin') {
      const routes = [
        ...((scopeRoutes ?? []) as AdminRouteDefinition[]),
        ...window.extensionContext.extensionRegistry.routes.adminRoutes,
      ];
      for (const interceptor of window.extensionContext.extensionRegistry.routes.adminRouteInterceptors) {
        interceptor(routes);
      }

      return routes
        .filter((route) => route.name && (!route.filter || route.filter()))
        .filter((route) => canAdminRoute(route.permission))
        .map((route) => {
          const path = to(route.path, '/admin');

          return {
            key: `nav:${route.path}`,
            category: CORE_QUICK_ACTION_CATEGORIES.navigation,
            label: resolveString(route.name)!,
            path,
            icon: route.icon ? <FontAwesomeIcon icon={route.icon} /> : undefined,
            onSelect: () => {
              setOpen(false);
              navigate(path);
            },
          };
        });
    }

    return [];
  }, [
    scope,
    serverId,
    scopeRoutes,
    userRouteOrder,
    server?.eggConfiguration?.routeOrder,
    setOpen,
    navigate,
    canServer,
    canAdminRoute,
  ]);

  const matchesQuery = useCallback(
    (item: QuickActionItem) => {
      if (!normalizedQuery) return true;
      if (item.label.toLowerCase().includes(normalizedQuery)) return true;
      return item.keywords?.some((keyword) => keyword.toLowerCase().includes(normalizedQuery)) ?? false;
    },
    [normalizedQuery],
  );

  const serverItems: QuickActionItem[] = useMemo(
    () =>
      scope === 'dashboard' && !mode
        ? servers.items
            .filter((s) => !normalizedQuery || s.name.toLowerCase().includes(normalizedQuery))
            .slice(0, 6)
            .map((s) => buildServerQuickActionItem(s, navigate, () => setOpen(false), serverTarget(s)))
        : [],
    [scope, mode, servers.items, normalizedQuery, navigate, setOpen, serverTarget],
  );

  const allItems = useMemo(
    () =>
      mode
        ? [
            ...(mode.items ?? []),
            ...[...actionItems, ...navItems].map((item) => mode.map?.(item) ?? null).filter((item) => item !== null),
          ]
        : [...actionItems, ...navItems].filter(matchesQuery).concat(serverItems),
    [mode, actionItems, navItems, serverItems, matchesQuery],
  );

  const categories: Record<string, QuickActionCategory> = useMemo(
    () => ({
      ...buildCoreQuickActionCategories(),
      ...window.extensionContext.extensionRegistry.quickActions.categories,
    }),
    [],
  );

  const categoryLabel = useCallback((id: string) => resolveString(categories[id]?.label) ?? id, [categories]);
  const categoryIconOf = useCallback((id: string): ReactNode => categories[id]?.icon, [categories]);

  const { grouped, flatItems, flatItemIndex } = useMemo(() => {
    const byCategory = new Map<string, QuickActionItem[]>();
    for (const item of allItems) {
      const list = byCategory.get(item.category) ?? [];
      list.push(item);
      byCategory.set(item.category, list);
    }

    const categoryOrder = (id: string) => categories[id]?.order ?? DEFAULT_CATEGORY_ORDER;

    const orderedCategoryIds = Array.from(byCategory.keys()).sort(
      (a, b) => categoryOrder(a) - categoryOrder(b) || categoryLabel(a).localeCompare(categoryLabel(b)),
    );

    const groupedResult = orderedCategoryIds.map((id) => ({
      id,
      label: categoryLabel(id),
      icon: categoryIconOf(id),
      items: byCategory.get(id)!,
    }));

    const flatItemsResult = groupedResult.flatMap((group) => group.items);
    const flatItemIndexResult = new Map(flatItemsResult.map((item, index) => [item.key, index]));

    return { grouped: groupedResult, flatItems: flatItemsResult, flatItemIndex: flatItemIndexResult };
  }, [allItems, categories]);

  const itemsKey = useMemo(() => flatItems.map((item) => item.key).join('|'), [flatItems]);

  useEffect(() => {
    if (open) comboboxRef.current.selectFirstOption();
  }, [open, itemsKey]);

  const handleOptionSubmit = (value: string) => {
    flatItems.find((item) => item.key === value)?.onSelect();
  };

  return (
    <>
      <Modal
        opened={open}
        onClose={close}
        withCloseButton={false}
        padding={0}
        size='lg'
        transitionProps={{
          transition: 'pop',
          duration: 150,
          onEntered: () => combobox.selectFirstOption(),
        }}
      >
        <Combobox store={combobox} onOptionSubmit={handleOptionSubmit} size='lg' withinPortal={false}>
          <style>{`
            .mantine-Combobox-option[data-danger][data-combobox-selected] {
              background-color: var(--mantine-color-red-light) !important;
            }
          `}</style>
          <div className='p-3 border-b border-(--mantine-color-default-border)'>
            <Combobox.Search
              value={query}
              onChange={(e) => setQuery(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') close();
              }}
              placeholder={t('elements.quickActions.placeholder', {})}
              leftSection={<FontAwesomeIcon icon={faMagnifyingGlass} size='sm' />}
              rightSection={
                (scope === 'dashboard' && !mode && servers.loading) || mode?.loading ? <Spinner size={14} /> : undefined
              }
              data-autofocus
              styles={{
                input: {
                  margin: 0,
                  width: '100%',
                  border: 'calc(0.0625rem * var(--mantine-scale)) solid var(--input-bd)',
                  backgroundColor: 'var(--input-bg)',
                  borderRadius: 'var(--input-radius)',
                },
              }}
            />
          </div>

          <div className='max-h-120 overflow-y-auto p-2'>
            <Combobox.Options>
              {flatItems.length === 0 && <Combobox.Empty>{t('elements.selectInput.noResults', {})}</Combobox.Empty>}

              {grouped.map((group, index) => (
                <Combobox.Group
                  key={group.id}
                  label={
                    <Group gap={6} wrap='nowrap'>
                      {group.icon}
                      {/* Stacked groups sharing a heading - a page's nested tab bars - only name the first. */}
                      {grouped[index - 1]?.label !== group.label && <span>{group.label}</span>}
                    </Group>
                  }
                >
                  {group.items.map((item) => {
                    const index = flatItemIndex.get(item.key)!;
                    const isSelected = index === combobox.selectedOptionIndex;

                    return (
                      <Combobox.Option
                        key={item.key}
                        value={item.key}
                        selected={isSelected}
                        onMouseMove={() => combobox.selectOption(index)}
                        c={item.danger ? 'red' : undefined}
                        mod={item.danger ? { danger: true } : undefined}
                      >
                        <Group gap='sm' wrap='nowrap'>
                          {item.icon}
                          <div className='flex flex-col min-w-0'>
                            <Text size='sm' c='inherit'>
                              {item.label}
                            </Text>
                            {item.content}
                          </div>
                          {item.description && (
                            <Text size='xs' c='inherit' opacity={0.6} ml='auto'>
                              {item.description}
                            </Text>
                          )}
                        </Group>
                      </Combobox.Option>
                    );
                  })}
                </Combobox.Group>
              ))}
            </Combobox.Options>
          </div>

          <div className='flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-(--mantine-color-default-border) px-4 py-3'>
            <Group gap={4}>
              <Kbd size='xs'>↑</Kbd>
              <Kbd size='xs'>↓</Kbd>
              <Text size='xs' c='dimmed'>
                {t('elements.quickActions.hint.navigate', {})}
              </Text>
            </Group>
            <Group gap={4}>
              <Kbd size='xs'>Enter</Kbd>
              <Text size='xs' c='dimmed'>
                {t('elements.quickActions.hint.select', {})}
              </Text>
            </Group>
            <Group gap={4}>
              <Kbd size='xs'>Esc</Kbd>
              <Text size='xs' c='dimmed'>
                {t('elements.quickActions.hint.close', {})}
              </Text>
            </Group>
            {modes.map((m) => (
              <Group key={m.id} gap={4}>
                <Kbd size='xs'>{m.prefix}</Kbd>
                <Text size='xs' c='dimmed'>
                  {resolveString(m.hint)}
                </Text>
              </Group>
            ))}
          </div>
        </Combobox>
      </Modal>

      {logoutModal}
    </>
  );
}
