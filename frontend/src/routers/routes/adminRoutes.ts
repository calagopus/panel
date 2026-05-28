import {
  faBriefcase,
  faBuilding,
  faBullhorn,
  faCogs,
  faCrow,
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
import AdminActivity from '@/pages/admin/activity/AdminActivity.tsx';
import AdminAnnouncements from '@/pages/admin/announcements/AdminAnnouncements.tsx';
import AdminAssets from '@/pages/admin/assets/AdminAssets.tsx';
import AdminBackupConfigurations from '@/pages/admin/backupConfigurations/AdminBackupConfigurations.tsx';
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
    name: () => getTranslations().t('pages.admin.settings.title', {}),
    icon: faWrench,
    path: '/settings/*',
    element: AdminSettings,
    permission: ['settings.*'],
  },
  {
    name: () => getTranslations().t('pages.admin.announcements.title', {}),
    icon: faBullhorn,
    path: '/announcements/*',
    element: AdminAnnouncements,
    permission: ['announcements.*'],
  },
  {
    name: () => getTranslations().t('pages.admin.assets.title', {}),
    icon: faFolderOpen,
    path: '/assets',
    element: AdminAssets,
    permission: ['assets.*'],
  },
  {
    name: () => getTranslations().t('pages.admin.extensions.title', {}),
    icon: faPuzzlePiece,
    path: '/extensions',
    element: AdminExtensions,
    permission: ['extensions.*'],
  },
  {
    name: undefined,
    path: '/extensions/:packageName',
    element: AdminExtensionsExtension,
    permission: ['extensions.*'],
  },
  {
    name: () => getTranslations().t('pages.admin.users.title', {}),
    icon: faUsers,
    path: '/users/*',
    element: AdminUsers,
    permission: ['users.*'],
  },
  {
    name: () => getTranslations().t('pages.admin.locations.title', {}),
    icon: faEarthAmerica,
    path: '/locations/*',
    element: AdminLocations,
    permission: ['locations.*'],
  },
  {
    name: () => getTranslations().t('pages.admin.nodes.title', {}),
    icon: faServer,
    path: '/nodes/*',
    element: AdminNodes,
    permission: ['nodes.*'],
  },
  {
    name: () => getTranslations().t('pages.admin.servers.title', {}),
    icon: faComputer,
    path: '/servers/*',
    element: AdminServers,
    permission: ['servers.*'],
  },
  {
    name: () => getTranslations().t('pages.admin.nests.title', {}),
    icon: faCrow,
    path: '/nests/*',
    element: AdminNests,
    permission: ['nests.*'],
  },
  {
    name: () => getTranslations().t('pages.admin.eggConfigurations.title', {}),
    icon: faCogs,
    path: '/egg-configurations/*',
    element: AdminEggConfigurations,
    permission: ['egg-configurations.*'],
  },
  {
    name: () => getTranslations().t('pages.admin.eggRepositories.title', {}),
    icon: faDownload,
    path: '/egg-repositories/*',
    element: AdminEggRepositories,
    permission: ['egg-repositories.*'],
  },
  {
    name: () => getTranslations().t('pages.admin.databaseHosts.title', {}),
    icon: faDatabase,
    path: '/database-hosts/*',
    element: AdminDatabaseHosts,
    permission: ['database-hosts.*'],
  },
  {
    name: () => getTranslations().t('pages.admin.oAuthProviders.title', {}),
    icon: faFingerprint,
    path: '/oauth-providers/*',
    element: AdminOAuthProviders,
    permission: ['oauth-providers.*'],
  },
  {
    name: () => getTranslations().t('pages.admin.backupConfigurations.title', {}),
    icon: faFileZipper,
    path: '/backup-configurations/*',
    element: AdminBackupConfigurations,
    permission: ['backup-configurations.*'],
  },
  {
    name: () => getTranslations().t('pages.admin.mounts.title', {}),
    icon: faFolderTree,
    path: '/mounts/*',
    element: AdminMounts,
    permission: ['mounts.*'],
  },
  {
    name: () => getTranslations().t('pages.admin.roles.title', {}),
    icon: faScroll,
    path: '/roles/*',
    element: AdminRoles,
    permission: ['roles.*'],
  },
  {
    name: () => getTranslations().t('pages.admin.activity.title', {}),
    icon: faBriefcase,
    path: '/activity',
    element: AdminActivity,
    permission: ['activity.*'],
  },
];

export default routes;
