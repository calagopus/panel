import { faMagnifyingGlass, faServer } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Combobox, useCombobox } from '@mantine/core';
import { ReactNode, useEffect, useReducer, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useShallow } from 'zustand/react/shallow';
import getServers from '@/api/server/getServers.ts';
import Group from '@/elements/Group.tsx';
import Kbd from '@/elements/Kbd.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { Modal } from '@/elements/modals/Modal.tsx';
import Spinner from '@/elements/Spinner.tsx';
import Text from '@/elements/Text.tsx';
import {
  buildCoreQuickActionCategories,
  CORE_QUICK_ACTION_CATEGORIES,
  getQuickActionDefinitions,
  getQuickActionModes,
} from '@/lib/coreQuickActions.tsx';
import { resolveString } from '@/lib/lazy.ts';
import { isAdmin } from '@/lib/permissions.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import type {
  QuickActionCategory,
  QuickActionContext,
  QuickActionItem,
  QuickActionModeContext,
  QuickActionScope,
} from '@/lib/quickActions.ts';
import { getAccessibleRoutePaths, to } from '@/lib/routes.ts';
import { useKeyboardShortcuts } from '@/plugins/useKeyboardShortcuts.ts';
import { checkPermissions } from '@/plugins/usePermissions.ts';
import { useSearchableResource } from '@/plugins/useSearchableResource.ts';
import { SocketRequest } from '@/plugins/useWebsocketEvent.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import accountRoutesBase from '@/routers/routes/accountRoutes.ts';
import adminRoutesBase from '@/routers/routes/adminRoutes.ts';
import serverRoutesBase from '@/routers/routes/serverRoutes.ts';
import { useGlobalStore } from '@/stores/global.ts';
import { useQuickActionsStore } from '@/stores/quickActions.ts';
import { useServerStore } from '@/stores/server.ts';

const SERVERS_CATEGORY_ID = 'servers';
const DEFAULT_CATEGORY_ORDER = 100;

export default function QuickActionsPalette() {
  const { t } = useTranslations();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, impersonating, doLogout } = useAuth();
  const { addToast } = useToast();

  const open = useQuickActionsStore((state) => state.open);
  const setOpen = useQuickActionsStore((state) => state.setOpen);
  const pageActions = useQuickActionsStore((state) => state.pageActions);
  const userRouteOrder = useGlobalStore((state) => state.settings.user?.routeOrder);

  useKeyboardShortcuts({
    shortcuts: [{ id: 'general.quickActions', callback: () => setOpen(true) }],
  });

  const combobox = useCombobox();
  const comboboxRef = useRef(combobox);
  comboboxRef.current = combobox;

  const [query, setQuery] = useState('');
  const [killConfirmOpen, setKillConfirmOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [, refresh] = useReducer((count: number) => count + 1, 0);

  const { server, socketInstance, serverState } = useServerStore(
    useShallow((state) => ({
      server: state.server,
      socketInstance: state.socketInstance,
      serverState: state.state,
    })),
  );

  const rawServerId = location.pathname.match(/^\/server\/([^/]+)/)?.[1];
  const serverId = rawServerId && rawServerId !== ':id' ? rawServerId : undefined;
  const scope: QuickActionScope = serverId ? 'server' : location.pathname.startsWith('/admin') ? 'admin' : 'dashboard';

  useEffect(() => {
    if (open) {
      comboboxRef.current.openDropdown();
    } else {
      setQuery('');
    }
  }, [open]);

  const servers = useSearchableResource<{ uuid: string; name: string }>({
    queryKey: queryKeys.user.servers.all(),
    fetcher: (search) => getServers(1, search),
    canRequest: open && scope === 'dashboard',
  });

  const close = () => setOpen(false);

  const modes = getQuickActionModes();
  const mode = modes.find((m) => query.startsWith(m.prefix));

  const modeContext: QuickActionModeContext | null = mode
    ? { term: query.slice(mode.prefix.length).trim(), close, addToast, refresh }
    : null;

  const modeContextRef = useRef(modeContext);
  modeContextRef.current = modeContext;

  useEffect(() => {
    if (!mode) {
      servers.setSearch(query);
      return;
    }

    if (modeContextRef.current) {
      mode.prepare?.(modeContextRef.current);
    }
  }, [query]);

  const normalizedQuery = query.trim().toLowerCase();

  const serverPermissions =
    scope === 'server' ? [...(server?.permissions || []), ...(user?.role?.serverPermissions || [])] : [];

  const canServer = (action: string | string[], matchAny = true) => {
    if (serverPermissions.includes('*')) return true;
    const matrix = checkPermissions(serverPermissions, action);
    return matchAny ? matrix.some(Boolean) : matrix.every(Boolean);
  };

  const canAdminRoute = (permission?: string | string[] | null) => {
    if (!permission) return true;
    if (user?.admin) return true;
    return checkPermissions(user?.role?.adminPermissions ?? [], permission).some(Boolean);
  };

  const actionContext: QuickActionContext = {
    scope,
    navigate,
    close,
    user,
    server: scope === 'server' ? server : null,
    serverState: scope === 'server' ? serverState : null,
    socketInstance,
    doLogout,
    canServer,
    requestServerKill: () => setKillConfirmOpen(true),
    requestLogout: () => (impersonating ? doLogout() : setLogoutConfirmOpen(true)),
  };

  const registryItems: QuickActionItem[] = [
    ...getQuickActionDefinitions(),
    ...pageActions.flatMap((provider) => provider()),
  ]
    .filter((definition) => !definition.scopes || definition.scopes.includes(scope))
    .filter((definition) => !definition.permission || canServer(definition.permission))
    .filter(
      (definition) =>
        definition.adminPermission === undefined ||
        isAdmin(user, definition.adminPermission === true ? undefined : definition.adminPermission),
    )
    .filter((definition) => !definition.isVisible || definition.isVisible(actionContext))
    .map((definition) => ({
      key: `action:${definition.id}`,
      category: definition.category,
      label: resolveString(definition.label),
      description: resolveString(definition.description),
      keywords: definition.keywords,
      icon: definition.icon,
      danger: definition.danger,
      onSelect: () => {
        close();
        definition.perform(actionContext);
      },
    }));

  let navItems: QuickActionItem[] = [];

  if (scope === 'dashboard') {
    const routes = [...accountRoutesBase, ...window.extensionContext.extensionRegistry.routes.accountRoutes];
    for (const interceptor of window.extensionContext.extensionRegistry.routes.accountRouteInterceptors) {
      interceptor(routes);
    }

    const accessibleRoutePaths = getAccessibleRoutePaths(routes, userRouteOrder);

    navItems = routes
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
            close();
            navigate(path);
          },
        };
      });
  } else if (serverId) {
    const routes = [...serverRoutesBase, ...window.extensionContext.extensionRegistry.routes.serverRoutes];
    for (const interceptor of window.extensionContext.extensionRegistry.routes.serverRouteInterceptors) {
      interceptor(routes);
    }

    const accessibleRoutePaths = getAccessibleRoutePaths(routes, server?.eggConfiguration?.routeOrder);

    navItems = routes
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
            close();
            navigate(path);
          },
        };
      });
  } else if (scope === 'admin') {
    const routes = [...adminRoutesBase, ...window.extensionContext.extensionRegistry.routes.adminRoutes];
    for (const interceptor of window.extensionContext.extensionRegistry.routes.adminRouteInterceptors) {
      interceptor(routes);
    }

    navItems = routes
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
            close();
            navigate(path);
          },
        };
      });
  }

  const matchesQuery = (item: QuickActionItem) => {
    if (!normalizedQuery) return true;
    if (item.label.toLowerCase().includes(normalizedQuery)) return true;
    return item.keywords?.some((keyword) => keyword.toLowerCase().includes(normalizedQuery)) ?? false;
  };

  const serverItems: QuickActionItem[] =
    scope === 'dashboard' && !mode
      ? servers.items
          .filter((s) => !normalizedQuery || s.name.toLowerCase().includes(normalizedQuery))
          .slice(0, 6)
          .map((s) => ({
            key: `server:${s.uuid}`,
            category: SERVERS_CATEGORY_ID,
            label: s.name,
            icon: <FontAwesomeIcon icon={faServer} />,
            onSelect: () => {
              close();
              navigate(`/server/${s.uuid.slice(0, 8)}`);
            },
          }))
      : [];

  const allItems =
    mode && modeContext
      ? [
          ...(mode.items?.(modeContext) ?? []),
          ...[...registryItems, ...navItems]
            .map((item) => mode.map?.(item, modeContext) ?? null)
            .filter((item) => item !== null),
        ]
      : [...registryItems, ...navItems].filter(matchesQuery).concat(serverItems);

  const categories: Record<string, QuickActionCategory> = {
    ...buildCoreQuickActionCategories(),
    [SERVERS_CATEGORY_ID]: {
      id: SERVERS_CATEGORY_ID,
      label: () => t('elements.quickActions.category.servers', {}),
      icon: <FontAwesomeIcon icon={faServer} size='sm' />,
      order: 40,
    },
    ...window.extensionContext.extensionRegistry.quickActions.categories,
  };

  const categoryLabel = (id: string) => resolveString(categories[id]?.label) ?? id;
  const categoryIconOf = (id: string): ReactNode => categories[id]?.icon;

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

  const grouped = orderedCategoryIds.map((id) => ({
    id,
    label: categoryLabel(id),
    icon: categoryIconOf(id),
    items: byCategory.get(id)!,
  }));

  const flatItems = grouped.flatMap((group) => group.items);
  const itemsKey = flatItems.map((item) => item.key).join('|');

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
              rightSection={scope === 'dashboard' && servers.loading ? <Spinner size={14} /> : undefined}
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

              {grouped.map((group) => (
                <Combobox.Group
                  key={group.id}
                  label={
                    <Group gap={6} wrap='nowrap'>
                      {group.icon}
                      <span>{group.label}</span>
                    </Group>
                  }
                >
                  {group.items.map((item) => {
                    const index = flatItems.indexOf(item);
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
                          <Text size='sm' c='inherit'>
                            {item.label}
                          </Text>
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

      <ConfirmationModal
        opened={killConfirmOpen}
        onClose={() => setKillConfirmOpen(false)}
        title={t('pages.server.console.power.modal.forceStop.title', {})}
        confirm={t('common.button.continue', {})}
        onConfirmed={() => {
          socketInstance?.send(SocketRequest.SET_STATE, 'kill');
          setKillConfirmOpen(false);
        }}
      >
        {t('pages.server.console.power.modal.forceStop.content', {})}
      </ConfirmationModal>

      <ConfirmationModal
        opened={logoutConfirmOpen}
        onClose={() => setLogoutConfirmOpen(false)}
        title={t('elements.sidebar.modal.logout.title', {})}
        confirm={t('elements.sidebar.button.logout', {})}
        onConfirmed={() => {
          setLogoutConfirmOpen(false);
          doLogout();
        }}
      >
        {t('elements.sidebar.modal.logout.content', {})}
      </ConfirmationModal>
    </>
  );
}
