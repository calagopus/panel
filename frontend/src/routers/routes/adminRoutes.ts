import {
  faBriefcase,
  faBuilding,
  faBullhorn,
  faCogs,
  faCrow,
  faCubes,
  faDatabase,
  faDownload,
  faEarthAmerica,
  faFileZipper,
  faFingerprint,
  faFolderOpen,
  faFolderTree,
  faPuzzlePiece,
  faScroll,
  faServer,
  faUsers,
  faWrench,
} from '@fortawesome/free-solid-svg-icons';
import { faComputer } from '@fortawesome/free-solid-svg-icons/faComputer';
import type { AdminRouteDefinition } from 'shared';
import type { LazyString } from '@/lib/lazy.ts';
import AdminActivity from '@/pages/admin/activity/AdminActivity.tsx';
import AdminAnnouncements from '@/pages/admin/announcements/AdminAnnouncements.tsx';
import AdminAssets from '@/pages/admin/assets/AdminAssets.tsx';
import AdminBackupConfigurations from '@/pages/admin/backupConfigurations/AdminBackupConfigurations.tsx';
import AdminDatabaseAgentHosts from '@/pages/admin/databaseAgentHosts/AdminDatabaseAgentHosts.tsx';
import AdminDatabaseAgentTemplates from '@/pages/admin/databaseAgentTemplates/AdminDatabaseAgentTemplates.tsx';
import AdminDatabaseHosts from '@/pages/admin/databaseHosts/AdminDatabaseHosts.tsx';
import AdminEggConfigurations from '@/pages/admin/eggConfigurations/AdminEggConfigurations.tsx';
import AdminEggRepositories from '@/pages/admin/eggRepositories/AdminEggRepositories.tsx';
import AdminExtensions from '@/pages/admin/extensions/AdminExtensions.tsx';
import AdminExtensionsExtension from '@/pages/admin/extensions/extension/AdminExtensionsExtension.tsx';
import AdminHome from '@/pages/admin/home/AdminHome.tsx';
import AdminLocations from '@/pages/admin/locations/AdminLocations.tsx';
import AdminMounts from '@/pages/admin/mounts/AdminMounts.tsx';
import AdminNests from '@/pages/admin/nests/AdminNests.tsx';
import AdminNodes from '@/pages/admin/nodes/AdminNodes.tsx';
import AdminOAuthProviders from '@/pages/admin/oAuthProviders/AdminOAuthProviders.tsx';
import AdminRoles from '@/pages/admin/roles/AdminRoles.tsx';
import AdminServers from '@/pages/admin/servers/AdminServers.tsx';
import AdminSettings from '@/pages/admin/settings/AdminSettings.tsx';
import AdminUsers from '@/pages/admin/users/AdminUsers.tsx';
import { getTranslations } from '@/providers/TranslationProvider.tsx';

export const adminSidebarCategoryOrder: { key: string; label: LazyString }[] = [
  { key: 'system', label: () => getTranslations().t('pages.admin.categories.system', {}) },
  { key: 'infrastructure', label: () => getTranslations().t('pages.admin.categories.infrastructure', {}) },
  { key: 'access', label: () => getTranslations().t('pages.admin.categories.access', {}) },
  { key: 'eggs', label: () => getTranslations().t('pages.admin.categories.eggs', {}) },
  { key: 'databases', label: () => getTranslations().t('pages.admin.categories.databases', {}) },
  { key: 'storage', label: () => getTranslations().t('pages.admin.categories.storage', {}) },
];

const routes: AdminRouteDefinition[] = [
  {
    name: () => getTranslations().t('pages.admin.home.title', {}),
    icon: faBuilding,
    path: '/*',
    activeMatches: ['/admin/updates', '/admin/health'],
    element: AdminHome,
    exact: true,
  },

  {
    name: () => getTranslations().t('pages.admin.locations.title', {}),
    icon: faEarthAmerica,
    path: '/locations/*',
    element: AdminLocations,
    permission: ['locations.*'],
    category: 'infrastructure',
  },
  {
    name: () => getTranslations().t('pages.admin.nodes.title', {}),
    icon: faServer,
    path: '/nodes/*',
    element: AdminNodes,
    permission: ['nodes.*'],
    category: 'infrastructure',
  },
  {
    name: () => getTranslations().t('pages.admin.servers.title', {}),
    icon: faComputer,
    path: '/servers/*',
    element: AdminServers,
    permission: ['servers.*'],
    category: 'infrastructure',
  },

  {
    name: () => getTranslations().t('pages.admin.nests.title', {}),
    icon: faCrow,
    path: '/nests/*',
    element: AdminNests,
    permission: ['nests.*'],
    category: 'eggs',
  },
  {
    name: () => getTranslations().t('pages.admin.eggConfigurations.title', {}),
    icon: faCogs,
    path: '/egg-configurations/*',
    element: AdminEggConfigurations,
    permission: ['egg-configurations.*'],
    category: 'eggs',
  },
  {
    name: () => getTranslations().t('pages.admin.eggRepositories.title', {}),
    icon: faDownload,
    path: '/egg-repositories/*',
    element: AdminEggRepositories,
    permission: ['egg-repositories.*'],
    category: 'eggs',
  },

  {
    name: () => getTranslations().t('pages.admin.databaseHosts.title', {}),
    icon: faDatabase,
    path: '/database-hosts/*',
    element: AdminDatabaseHosts,
    permission: ['database-hosts.*'],
    category: 'databases',
  },
  {
    name: () => getTranslations().t('pages.admin.databaseAgentHosts.title', {}),
    icon: faServer,
    path: '/database-agent-hosts/*',
    element: AdminDatabaseAgentHosts,
    permission: ['database-agent-hosts.*'],
    category: 'databases',
  },
  {
    name: () => getTranslations().t('pages.admin.databaseAgentTemplates.title', {}),
    icon: faCubes,
    path: '/database-agent-templates/*',
    element: AdminDatabaseAgentTemplates,
    permission: ['database-agent-templates.*'],
    category: 'databases',
  },

  {
    name: () => getTranslations().t('pages.admin.mounts.title', {}),
    icon: faFolderTree,
    path: '/mounts/*',
    element: AdminMounts,
    permission: ['mounts.*'],
    category: 'storage',
  },
  {
    name: () => getTranslations().t('pages.admin.backupConfigurations.title', {}),
    icon: faFileZipper,
    path: '/backup-configurations/*',
    element: AdminBackupConfigurations,
    permission: ['backup-configurations.*'],
    category: 'storage',
  },

  {
    name: () => getTranslations().t('pages.admin.users.title', {}),
    icon: faUsers,
    path: '/users/*',
    element: AdminUsers,
    permission: ['users.*'],
    category: 'access',
  },
  {
    name: () => getTranslations().t('pages.admin.roles.title', {}),
    icon: faScroll,
    path: '/roles/*',
    element: AdminRoles,
    permission: ['roles.*'],
    category: 'access',
  },
  {
    name: () => getTranslations().t('pages.admin.oAuthProviders.title', {}),
    icon: faFingerprint,
    path: '/oauth-providers/*',
    element: AdminOAuthProviders,
    permission: ['oauth-providers.*'],
    category: 'access',
  },
  {
    name: () => getTranslations().t('pages.admin.activity.title', {}),
    icon: faBriefcase,
    path: '/activity',
    element: AdminActivity,
    permission: ['activity.*'],
    category: 'access',
  },

  {
    name: () => getTranslations().t('pages.admin.settings.title', {}),
    icon: faWrench,
    path: '/settings/*',
    element: AdminSettings,
    permission: ['settings.*'],
    category: 'system',
  },
  {
    name: () => getTranslations().t('pages.admin.announcements.title', {}),
    icon: faBullhorn,
    path: '/announcements/*',
    element: AdminAnnouncements,
    permission: ['announcements.*'],
    category: 'system',
  },
  {
    name: () => getTranslations().t('pages.admin.assets.title', {}),
    icon: faFolderOpen,
    path: '/assets',
    element: AdminAssets,
    permission: ['assets.*'],
    category: 'system',
  },
  {
    name: () => getTranslations().t('pages.admin.extensions.title', {}),
    icon: faPuzzlePiece,
    path: '/extensions',
    element: AdminExtensions,
    permission: ['extensions.*'],
    category: 'system',
  },
  {
    name: undefined,
    path: '/extensions/:packageName',
    element: AdminExtensionsExtension,
    permission: ['extensions.*'],
  },
];

export default routes;
