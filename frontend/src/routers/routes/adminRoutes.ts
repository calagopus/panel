import {
  faBriefcase,
  faBuilding,
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

const routes: AdminRouteDefinition[] = [
  {
    name: 'Home',
    icon: faBuilding,
    path: '/*',
    activeMatches: ['/admin/updates', '/admin/health'],
    element: AdminHome,
    exact: true,
  },
  {
    name: 'Settings',
    icon: faWrench,
    path: '/settings/*',
    element: AdminSettings,
    permission: ['settings.*'],
  },
  {
    name: 'Assets',
    icon: faFolderOpen,
    path: '/assets',
    element: AdminAssets,
    permission: ['assets.*'],
  },
  {
    name: 'Extensions',
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
    name: 'Users',
    icon: faUsers,
    path: '/users/*',
    element: AdminUsers,
    permission: ['users.*'],
  },
  {
    name: 'Locations',
    icon: faEarthAmerica,
    path: '/locations/*',
    element: AdminLocations,
    permission: ['locations.*'],
  },
  {
    name: 'Nodes',
    icon: faServer,
    path: '/nodes/*',
    element: AdminNodes,
    permission: ['nodes.*'],
  },
  {
    name: 'Servers',
    icon: faComputer,
    path: '/servers/*',
    element: AdminServers,
    permission: ['servers.*'],
  },
  {
    name: 'Nests',
    icon: faCrow,
    path: '/nests/*',
    element: AdminNests,
    permission: ['nests.*'],
  },
  {
    name: 'Egg Configurations',
    icon: faCogs,
    path: '/egg-configurations/*',
    element: AdminEggConfigurations,
    permission: ['egg-configurations.*'],
  },
  {
    name: 'Egg Repositories',
    icon: faDownload,
    path: '/egg-repositories/*',
    element: AdminEggRepositories,
    permission: ['egg-repositories.*'],
  },
  {
    name: 'Database Hosts',
    icon: faDatabase,
    path: '/database-hosts/*',
    element: AdminDatabaseHosts,
    permission: ['database-hosts.*'],
  },
  {
    name: 'OAuth Providers',
    icon: faFingerprint,
    path: '/oauth-providers/*',
    element: AdminOAuthProviders,
    permission: ['oauth-providers.*'],
  },
  {
    name: 'Backup Configs',
    icon: faFileZipper,
    path: '/backup-configurations/*',
    element: AdminBackupConfigurations,
    permission: ['backup-configurations.*'],
  },
  {
    name: 'Mounts',
    icon: faFolderTree,
    path: '/mounts/*',
    element: AdminMounts,
    permission: ['mounts.*'],
  },
  {
    name: 'Roles',
    icon: faScroll,
    path: '/roles/*',
    element: AdminRoles,
    permission: ['roles.*'],
  },
  {
    name: 'Activity',
    icon: faBriefcase,
    path: '/activity',
    element: AdminActivity,
    permission: ['activity.*'],
  },
];

export default routes;
