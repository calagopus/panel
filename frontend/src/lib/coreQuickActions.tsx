import {
  faArrowRightFromBracket,
  faCompass,
  faGraduationCap,
  faPlay,
  faPowerOff,
  faReply,
  faRotateRight,
  faServer,
  faSkull,
  faStop,
  faUserCog,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { QuickActionCategory, QuickActionDefinition } from '@/lib/quickActions.ts';
import { SocketRequest } from '@/plugins/useWebsocketEvent.ts';
import { getTranslations } from '@/providers/TranslationProvider.tsx';

export const CORE_QUICK_ACTION_CATEGORIES = {
  navigation: 'navigation',
  power: 'power',
  account: 'account',
} as const;

export function buildCoreQuickActionCategories(): Record<string, QuickActionCategory> {
  return {
    navigation: {
      id: CORE_QUICK_ACTION_CATEGORIES.navigation,
      label: () => getTranslations().t('elements.quickActions.category.navigation', {}),
      icon: <FontAwesomeIcon icon={faCompass} size='sm' />,
    },
    power: {
      id: CORE_QUICK_ACTION_CATEGORIES.power,
      label: () => getTranslations().t('elements.quickActions.category.power', {}),
      icon: <FontAwesomeIcon icon={faPowerOff} size='sm' />,
    },
    account: {
      id: CORE_QUICK_ACTION_CATEGORIES.account,
      label: () => getTranslations().t('elements.quickActions.category.account', {}),
      icon: <FontAwesomeIcon icon={faUserCog} size='sm' />,
    },
  };
}

let coreDefinitions: QuickActionDefinition[] | null = null;

export function getQuickActionDefinitions(): QuickActionDefinition[] {
  coreDefinitions ??= buildCoreQuickActionDefinitions();
  return [...coreDefinitions, ...window.extensionContext.extensionRegistry.quickActions.definitions];
}

function buildCoreQuickActionDefinitions(): QuickActionDefinition[] {
  const { navigation, power, account } = CORE_QUICK_ACTION_CATEGORIES;

  return [
    {
      id: 'general.goHome',
      category: navigation,
      label: () => getTranslations().t('pages.account.home.title', {}),
      icon: faServer,
      scopes: ['dashboard', 'server'],
      perform: (ctx) => ctx.navigate('/'),
    },
    {
      id: 'general.goAdmin',
      category: navigation,
      label: () => getTranslations().t('pages.account.admin.title', {}),
      icon: faGraduationCap,
      scopes: ['dashboard', 'server'],
      adminPermission: true,
      perform: (ctx) => ctx.navigate('/admin'),
    },
    {
      id: 'general.goBack',
      category: navigation,
      label: () => getTranslations().t('common.button.back', {}),
      icon: faReply,
      scopes: ['admin'],
      perform: (ctx) => ctx.navigate('/'),
    },
    {
      id: 'server.start',
      category: power,
      label: () => getTranslations().t('common.enum.serverPowerAction.start', {}),
      icon: faPlay,
      scopes: ['server'],
      permission: 'control.start',
      isVisible: (ctx) => ctx.serverState === 'offline',
      perform: (ctx) => ctx.socketInstance?.send(SocketRequest.SET_STATE, 'start'),
    },
    {
      id: 'server.stop',
      category: power,
      label: () => getTranslations().t('common.enum.serverPowerAction.stop', {}),
      icon: faStop,
      scopes: ['server'],
      permission: 'control.stop',
      isVisible: (ctx) => ctx.serverState !== 'offline' && ctx.serverState !== 'stopping',
      perform: (ctx) => ctx.socketInstance?.send(SocketRequest.SET_STATE, 'stop'),
    },
    {
      id: 'server.restart',
      category: power,
      label: () => getTranslations().t('common.enum.serverPowerAction.restart', {}),
      icon: faRotateRight,
      scopes: ['server'],
      permission: 'control.restart',
      isVisible: (ctx) => ctx.serverState === 'running',
      perform: (ctx) => ctx.socketInstance?.send(SocketRequest.SET_STATE, 'restart'),
    },
    {
      id: 'server.kill',
      category: power,
      label: () => getTranslations().t('common.enum.serverPowerAction.kill', {}),
      icon: faSkull,
      danger: true,
      scopes: ['server'],
      permission: 'control.stop',
      isVisible: (ctx) => ctx.serverState === 'stopping',
      perform: (ctx) => ctx.requestServerKill(),
    },
    {
      id: 'general.logout',
      category: account,
      label: () => getTranslations().t('elements.sidebar.button.logout', {}),
      icon: faArrowRightFromBracket,
      danger: true,
      perform: (ctx) => ctx.doLogout(),
    },
  ];
}
