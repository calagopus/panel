import {
  faBoxArchive,
  faBriefcase,
  faCog,
  faDatabase,
  faFolderOpen,
  faFolderTree,
  faNetworkWired,
  faPlay,
  faStopwatch,
  faTerminal,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import { lazy } from 'react';
import type { ServerRouteDefinition } from 'shared';
import ServerActivity from '@/pages/server/activity/ServerActivity.tsx';
import ServerBackups from '@/pages/server/backups/ServerBackups.tsx';
import ServerDatabases from '@/pages/server/databases/ServerDatabases.tsx';
import ServerFilesEditor from '@/pages/server/files/FileEditor.tsx';
import FileRevisionDiff from '@/pages/server/files/FileRevisionDiff.tsx';
import ServerFiles from '@/pages/server/files/ServerFiles.tsx';
import ServerMounts from '@/pages/server/mounts/ServerMounts.tsx';
import ServerNetwork from '@/pages/server/network/ServerNetwork.tsx';
import ScheduleView from '@/pages/server/schedules/ScheduleView.tsx';
import ServerSchedules from '@/pages/server/schedules/ServerSchedules.tsx';
import ServerSettings from '@/pages/server/settings/ServerSettings.tsx';
import ServerStartup from '@/pages/server/startup/ServerStartup.tsx';
import ServerSubusers from '@/pages/server/subusers/ServerSubusers.tsx';
import { getTranslations } from '@/providers/TranslationProvider.tsx';

const ServerConsole = lazy(() => import('@/pages/server/console/ServerConsole.tsx'));

const routes: ServerRouteDefinition[] = [
  {
    name: () => getTranslations().t('pages.server.console.title', {}),
    icon: faTerminal,
    path: '/',
    element: ServerConsole,
    exact: true,
    permission: null,
  },
  {
    name: () => getTranslations().t('pages.server.files.title', {}),
    icon: faFolderOpen,
    path: '/files',
    element: ServerFiles,
    permission: 'files.read',
  },
  {
    name: undefined,
    path: '/files/diff',
    element: FileRevisionDiff,
    permission: 'files.read-content',
  },
  {
    name: undefined,
    path: '/files/:action',
    element: ServerFilesEditor,
    permission: 'files.read',
  },
  {
    name: () => getTranslations().t('pages.server.databases.title', {}),
    icon: faDatabase,
    path: '/databases',
    element: ServerDatabases,
    permission: 'databases.read',
  },
  {
    name: () => getTranslations().t('pages.server.schedules.title', {}),
    icon: faStopwatch,
    path: '/schedules',
    element: ServerSchedules,
    permission: 'schedules.read',
  },
  {
    name: undefined,
    path: '/schedules/:id',
    element: ScheduleView,
    permission: 'schedules.read',
  },
  {
    name: () => getTranslations().t('pages.server.subusers.title', {}),
    icon: faUsers,
    path: '/subusers',
    element: ServerSubusers,
    permission: 'subusers.read',
  },
  {
    name: () => getTranslations().t('pages.server.backups.title', {}),
    icon: faBoxArchive,
    path: '/backups',
    element: ServerBackups,
    permission: 'backups.read',
  },
  {
    name: () => getTranslations().t('pages.server.network.title', {}),
    icon: faNetworkWired,
    path: '/network',
    element: ServerNetwork,
    permission: 'allocations.read',
  },
  {
    name: () => getTranslations().t('pages.server.startup.title', {}),
    icon: faPlay,
    path: '/startup',
    element: ServerStartup,
    permission: 'startup.read',
  },
  {
    name: () => getTranslations().t('pages.server.mounts.title', {}),
    icon: faFolderTree,
    path: '/mounts',
    element: ServerMounts,
    permission: 'mounts.read',
  },
  {
    name: () => getTranslations().t('pages.server.settings.title', {}),
    icon: faCog,
    path: '/settings',
    element: ServerSettings,
    permission: ['settings.*'],
  },
  {
    name: () => getTranslations().t('pages.server.activity.title', {}),
    icon: faBriefcase,
    path: '/activity',
    element: ServerActivity,
    permission: 'activity.read',
  },
];

export default routes;
