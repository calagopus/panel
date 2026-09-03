import {
  faArrowRightFromBracket,
  faCalculator,
  faCompass,
  faEquals,
  faFileLines,
  faFolderTree,
  faGraduationCap,
  faPowerOff,
  faReply,
  faServer,
  faUser,
  faUserCog,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { z } from 'zod';
import getAdminServers from '@/api/admin/servers/getServers.ts';
import getAdminUsers from '@/api/admin/users/getUsers.ts';
import { getImpersonatedUser } from '@/api/axios.ts';
import getServers from '@/api/server/getServers.ts';
import Avatar from '@/elements/data-display/Avatar.tsx';
import Group from '@/elements/layout/Group.tsx';
import Text from '@/elements/typography/Text.tsx';
import { handleRawCopyToClipboard } from '@/lib/clipboard/copy.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import type {
  QuickActionCategory,
  QuickActionDefinition,
  QuickActionItem,
  QuickActionMode,
} from '@/lib/quickActions/quickActions.ts';
import { evaluateMathExpression, getLoadedMath, loadMath } from '@/lib/quickActions/quickActionsMath.ts';
import type { adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import type { adminFullUserSchema } from '@/lib/schemas/admin/users.ts';
import type { serverSchema } from '@/lib/schemas/server/server.ts';
import { useQuickActionLocation, useQuickActionTerm } from '@/plugins/quick-actions/useQuickActions.ts';
import { useSearchableResource } from '@/plugins/resource/useSearchableResource.ts';
import { useServerListShowOthers } from '@/plugins/server/useServerListShowOthers.ts';
import { checkPermissions } from '@/plugins/usePermissions.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { getTranslations } from '@/providers/TranslationProvider.tsx';
import { useQuickActionsStore } from '@/stores/quickActions.ts';

export const CORE_QUICK_ACTION_CATEGORIES = {
  navigation: 'navigation',
  power: 'power',
  account: 'account',
  page: 'page',
  pageNavigation: 'pageNavigation',
  math: 'math',
  servers: 'servers',
  users: 'users',
} as const;

const PAGE_NAVIGATION_MAX_DEPTH = 4;

export function pageNavigationCategoryId(depth: number): string {
  const clamped = Math.min(Math.max(depth, 1), PAGE_NAVIGATION_MAX_DEPTH);

  return clamped === 1
    ? CORE_QUICK_ACTION_CATEGORIES.pageNavigation
    : `${CORE_QUICK_ACTION_CATEGORIES.pageNavigation}:${clamped}`;
}

function isPageNavigationCategory(id: string): boolean {
  return (
    id === CORE_QUICK_ACTION_CATEGORIES.pageNavigation ||
    id.startsWith(`${CORE_QUICK_ACTION_CATEGORIES.pageNavigation}:`)
  );
}

const MATH_PREFIX = '=';
const SERVERS_PREFIX = '#';
const USERS_PREFIX = '@';
const NAVIGATION_PREFIX = '/';

export function buildCoreQuickActionCategories(): Record<string, QuickActionCategory> {
  return {
    navigation: {
      id: CORE_QUICK_ACTION_CATEGORIES.navigation,
      label: () => getTranslations().t('elements.quickActions.category.navigation', {}),
      icon: <FontAwesomeIcon icon={faCompass} />,
      order: 50,
    },
    power: {
      id: CORE_QUICK_ACTION_CATEGORIES.power,
      label: () => getTranslations().t('elements.quickActions.category.power', {}),
      icon: <FontAwesomeIcon icon={faPowerOff} />,
      order: 30,
    },
    account: {
      id: CORE_QUICK_ACTION_CATEGORIES.account,
      label: () => getTranslations().t('elements.quickActions.category.account', {}),
      icon: <FontAwesomeIcon icon={faUserCog} />,
      order: 60,
    },
    page: {
      id: CORE_QUICK_ACTION_CATEGORIES.page,
      label: () => getTranslations().t('elements.quickActions.category.page', {}),
      icon: <FontAwesomeIcon icon={faFileLines} />,
      order: 20,
    },
    ...Object.fromEntries(
      Array.from({ length: PAGE_NAVIGATION_MAX_DEPTH }, (_, index): [string, QuickActionCategory] => {
        const id = pageNavigationCategoryId(index + 1);

        return [
          id,
          {
            id,
            label: () => getTranslations().t('elements.quickActions.category.pageNavigation', {}),
            icon: <FontAwesomeIcon icon={faFolderTree} />,
            order: 25 - index / 10,
          },
        ];
      }),
    ),
    math: {
      id: CORE_QUICK_ACTION_CATEGORIES.math,
      label: () => getTranslations().t('elements.quickActions.category.math', {}),
      icon: <FontAwesomeIcon icon={faCalculator} />,
      order: 10,
    },
    servers: {
      id: CORE_QUICK_ACTION_CATEGORIES.servers,
      label: () => getTranslations().t('elements.quickActions.category.servers', {}),
      icon: <FontAwesomeIcon icon={faServer} />,
      order: 40,
    },
    users: {
      id: CORE_QUICK_ACTION_CATEGORIES.users,
      label: () => getTranslations().t('elements.quickActions.category.users', {}),
      icon: <FontAwesomeIcon icon={faUsers} />,
      order: 45,
    },
  };
}

export function useServerQuickActionTarget(): (server: z.infer<typeof serverSchema>) => string {
  const location = useLocation();
  const { scope, serverId } = useQuickActionLocation();

  return (server) => {
    const base = `/server/${server.uuidShort}`;

    if (scope !== 'server' || server.uuidShort === serverId) return base;

    return `${base}${location.pathname.replace(/^\/server\/[^/]+/, '')}${location.search}${location.hash}`;
  };
}

export function buildServerQuickActionItem(
  server: z.infer<typeof serverSchema>,
  navigate: (path: string) => void,
  close: () => void,
  path: string,
): QuickActionItem {
  return {
    key: `server:${server.uuid}`,
    category: CORE_QUICK_ACTION_CATEGORIES.servers,
    label: server.name,
    description: server.nodeName,
    icon: <FontAwesomeIcon icon={faServer} />,
    onSelect: () => {
      close();
      navigate(path);
    },
  };
}

/** Admin scope jumps to the admin view and leads with the owner, since it searches every server. */
export function buildAdminServerQuickActionItem(
  server: z.infer<typeof adminServerSchema>,
  navigate: (path: string) => void,
  close: () => void,
): QuickActionItem {
  return {
    key: `admin-server:${server.uuid}`,
    category: CORE_QUICK_ACTION_CATEGORIES.servers,
    label: server.name,
    description: server.node.name,
    content: (
      <Group gap={6} wrap='nowrap'>
        <Avatar size={16} src={server.owner.avatar} name={server.owner.username} />
        <Text size='xs' c='inherit' opacity={0.6}>
          {server.owner.username}
        </Text>
      </Group>
    ),
    keywords: [server.owner.username],
    icon: <FontAwesomeIcon icon={faServer} />,
    onSelect: () => {
      close();
      navigate(`/admin/servers/${server.uuid}`);
    },
  };
}

export function buildAdminUserQuickActionItem(
  user: z.infer<typeof adminFullUserSchema>,
  navigate: (path: string) => void,
  close: () => void,
): QuickActionItem {
  const fullName = [user.nameFirst, user.nameLast].filter(Boolean).join(' ');

  return {
    key: `admin-user:${user.uuid}`,
    category: CORE_QUICK_ACTION_CATEGORIES.users,
    label: user.username,
    description: user.email,
    content: (
      <Group gap={6} wrap='nowrap'>
        <Avatar size={16} src={user.avatar} name={user.username} />
        {fullName && (
          <Text size='xs' c='inherit' opacity={0.6}>
            {fullName}
          </Text>
        )}
      </Group>
    ),
    keywords: [user.email, user.nameFirst, user.nameLast].filter((keyword): keyword is string => !!keyword),
    icon: <FontAwesomeIcon icon={faUser} />,
    onSelect: () => {
      close();
      navigate(`/admin/users/${user.uuid}`);
    },
  };
}

export function useCoreQuickActionModes(): QuickActionMode[] {
  const { addToast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { scope } = useQuickActionLocation();

  const canAdmin = (permission: string) =>
    !!user?.admin || checkPermissions(user?.role?.adminPermissions ?? [], permission).some(Boolean);

  const searchesAllServers = scope === 'admin' && canAdmin('servers.*');
  const canSearchUsers = scope === 'admin' && canAdmin('users.*');

  const open = useQuickActionsStore((state) => state.open);
  const setOpen = useQuickActionsStore((state) => state.setOpen);

  const mathTerm = useQuickActionTerm(MATH_PREFIX);
  const serversTerm = useQuickActionTerm(SERVERS_PREFIX);
  const navigationTerm = useQuickActionTerm(NAVIGATION_PREFIX)?.toLowerCase();

  const [showOthers] = useServerListShowOthers();
  const mathActive = mathTerm !== null;
  const [math, setMath] = useState(getLoadedMath());

  useEffect(() => {
    if (mathActive && !getLoadedMath()) {
      loadMath().then(setMath).catch(console.error);
    }
  }, [mathActive]);

  const servers = useSearchableResource<z.infer<typeof serverSchema>>({
    queryKey: [...queryKeys.user.servers.all(), { showOthers }],
    fetcher: (search) => getServers(1, search, showOthers),
    canRequest: open && serversTerm !== null && !searchesAllServers,
  });

  const adminServers = useSearchableResource<z.infer<typeof adminServerSchema>>({
    queryKey: queryKeys.admin.servers.all(),
    fetcher: (search) => getAdminServers(1, search),
    canRequest: open && serversTerm !== null && searchesAllServers,
  });

  const usersTerm = useQuickActionTerm(USERS_PREFIX);
  const users = useSearchableResource<z.infer<typeof adminFullUserSchema>>({
    queryKey: queryKeys.admin.users.all(),
    fetcher: (search) => getAdminUsers(1, search),
    canRequest: open && usersTerm !== null && canSearchUsers,
  });

  useEffect(() => {
    servers.setSearch(serversTerm ?? '');
    adminServers.setSearch(serversTerm ?? '');
  }, [serversTerm]);

  useEffect(() => {
    users.setSearch(usersTerm ?? '');
  }, [usersTerm]);

  const close = () => setOpen(false);
  const serverTarget = useServerQuickActionTarget();
  const mathResult = mathTerm && math ? evaluateMathExpression(math, mathTerm) : null;

  return [
    {
      id: 'math',
      prefix: MATH_PREFIX,
      hint: () => getTranslations().t('elements.quickActions.hint.calculate', {}),
      items: !mathTerm
        ? []
        : [
            {
              key: 'math:result',
              category: CORE_QUICK_ACTION_CATEGORIES.math,
              label: !math
                ? getTranslations().t('elements.quickActions.math.calculating', {})
                : (mathResult ?? getTranslations().t('elements.quickActions.math.unsolvable', {})),
              description: mathResult ? getTranslations().t('elements.quickActions.math.copyResult', {}) : undefined,
              icon: <FontAwesomeIcon icon={faEquals} />,
              onSelect: () => {
                if (!mathResult) return;

                close();
                handleRawCopyToClipboard(mathResult, addToast);
              },
            },
          ],
    },
    {
      id: 'servers',
      prefix: SERVERS_PREFIX,
      hint: () => getTranslations().t('elements.quickActions.hint.servers', {}),
      loading: searchesAllServers ? adminServers.loading : servers.loading,
      items: searchesAllServers
        ? adminServers.items.slice(0, 8).map((server) => buildAdminServerQuickActionItem(server, navigate, close))
        : servers.items
            .slice(0, 8)
            .map((server) => buildServerQuickActionItem(server, navigate, close, serverTarget(server))),
    },
    ...(canSearchUsers
      ? [
          {
            id: 'users',
            prefix: USERS_PREFIX,
            hint: () => getTranslations().t('elements.quickActions.hint.users', {}),
            loading: users.loading,
            items: users.items.slice(0, 8).map((item) => buildAdminUserQuickActionItem(item, navigate, close)),
          },
        ]
      : []),
    {
      id: 'navigation',
      prefix: NAVIGATION_PREFIX,
      hint: () => getTranslations().t('elements.quickActions.hint.pages', {}),
      map: (item) => {
        if (item.category !== CORE_QUICK_ACTION_CATEGORIES.navigation && !isPageNavigationCategory(item.category)) {
          return null;
        }

        if (
          navigationTerm &&
          !item.label.toLowerCase().includes(navigationTerm) &&
          !item.path?.toLowerCase().includes(navigationTerm)
        ) {
          return null;
        }

        return { ...item, description: item.path };
      },
    },
  ];
}

export function useCoreQuickActionDefinitions(requestLogout: () => void): QuickActionDefinition[] {
  const navigate = useNavigate();

  const { navigation, account } = CORE_QUICK_ACTION_CATEGORIES;

  return [
    {
      id: 'general.goHome',
      category: navigation,
      label: () => getTranslations().t('pages.account.home.title', {}),
      icon: <FontAwesomeIcon icon={faServer} />,
      scopes: ['dashboard', 'server'],
      perform: () => navigate('/'),
    },
    {
      id: 'general.goAdmin',
      category: navigation,
      label: () => getTranslations().t('pages.account.admin.title', {}),
      icon: <FontAwesomeIcon icon={faGraduationCap} />,
      scopes: ['dashboard', 'server'],
      adminPermission: true,
      perform: () => navigate('/admin'),
    },
    {
      id: 'general.goBack',
      category: navigation,
      label: () => getTranslations().t('common.button.back', {}),
      icon: <FontAwesomeIcon icon={faReply} />,
      scopes: ['admin'],
      perform: () => navigate('/'),
    },
    {
      id: 'general.logout',
      category: account,
      label: () =>
        getImpersonatedUser()
          ? getTranslations().t('elements.sidebar.button.stopImpersonating', {})
          : getTranslations().t('elements.sidebar.button.logout', {}),
      icon: <FontAwesomeIcon icon={faArrowRightFromBracket} />,
      danger: true,
      perform: requestLogout,
    },
  ];
}
