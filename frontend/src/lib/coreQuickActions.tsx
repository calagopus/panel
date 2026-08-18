import {
  faArrowRightFromBracket,
  faCalculator,
  faCompass,
  faEquals,
  faFileLines,
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
import { getImpersonatedUser } from '@/api/axios.ts';
import { handleRawCopyToClipboard } from '@/lib/copy.ts';
import type { QuickActionCategory, QuickActionDefinition, QuickActionMode } from '@/lib/quickActions.ts';
import { evaluateMathExpression, getLoadedMath, loadMath } from '@/lib/quickActionsMath.ts';
import { SocketRequest } from '@/plugins/useWebsocketEvent.ts';
import { getTranslations } from '@/providers/TranslationProvider.tsx';

export const CORE_QUICK_ACTION_CATEGORIES = {
  navigation: 'navigation',
  power: 'power',
  account: 'account',
  page: 'page',
  math: 'math',
} as const;

export function buildCoreQuickActionCategories(): Record<string, QuickActionCategory> {
  return {
    navigation: {
      id: CORE_QUICK_ACTION_CATEGORIES.navigation,
      label: () => getTranslations().t('elements.quickActions.category.navigation', {}),
      icon: <FontAwesomeIcon icon={faCompass} size='sm' />,
      order: 50,
    },
    power: {
      id: CORE_QUICK_ACTION_CATEGORIES.power,
      label: () => getTranslations().t('elements.quickActions.category.power', {}),
      icon: <FontAwesomeIcon icon={faPowerOff} size='sm' />,
      order: 30,
    },
    account: {
      id: CORE_QUICK_ACTION_CATEGORIES.account,
      label: () => getTranslations().t('elements.quickActions.category.account', {}),
      icon: <FontAwesomeIcon icon={faUserCog} size='sm' />,
      order: 60,
    },
    page: {
      id: CORE_QUICK_ACTION_CATEGORIES.page,
      label: () => getTranslations().t('elements.quickActions.category.page', {}),
      icon: <FontAwesomeIcon icon={faFileLines} size='sm' />,
      order: 20,
    },
    math: {
      id: CORE_QUICK_ACTION_CATEGORIES.math,
      label: () => getTranslations().t('elements.quickActions.category.math', {}),
      icon: <FontAwesomeIcon icon={faCalculator} size='sm' />,
      order: 10,
    },
  };
}

let coreDefinitions: QuickActionDefinition[] | null = null;
let coreModes: QuickActionMode[] | null = null;

export function getQuickActionDefinitions(): QuickActionDefinition[] {
  coreDefinitions ??= buildCoreQuickActionDefinitions();
  return [...coreDefinitions, ...window.extensionContext.extensionRegistry.quickActions.definitions];
}

export function getQuickActionModes(): QuickActionMode[] {
  coreModes ??= buildCoreQuickActionModes();
  return [...coreModes, ...window.extensionContext.extensionRegistry.quickActions.modes];
}

function buildCoreQuickActionModes(): QuickActionMode[] {
  return [
    {
      id: 'math',
      prefix: '=',
      hint: () => getTranslations().t('elements.quickActions.hint.calculate', {}),
      prepare: (ctx) => {
        if (!getLoadedMath()) loadMath().then(ctx.refresh).catch(console.error);
      },
      items: (ctx) => {
        if (!ctx.term) return [];

        const math = getLoadedMath();
        const result = math ? evaluateMathExpression(math, ctx.term) : null;

        return [
          {
            key: 'math:result',
            category: CORE_QUICK_ACTION_CATEGORIES.math,
            label: !math
              ? getTranslations().t('elements.quickActions.math.calculating', {})
              : (result ?? getTranslations().t('elements.quickActions.math.unsolvable', {})),
            description: result ? getTranslations().t('elements.quickActions.math.copyResult', {}) : undefined,
            icon: <FontAwesomeIcon icon={faEquals} />,
            onSelect: () => {
              if (!result) return;

              ctx.close();
              handleRawCopyToClipboard(result, ctx.addToast);
            },
          },
        ];
      },
    },
    {
      id: 'navigation',
      prefix: '/',
      hint: () => getTranslations().t('elements.quickActions.hint.pages', {}),
      map: (item, ctx) => {
        if (item.category !== CORE_QUICK_ACTION_CATEGORIES.navigation) return null;

        const term = ctx.term.toLowerCase();
        if (term && !item.label.toLowerCase().includes(term) && !item.path?.toLowerCase().includes(term)) return null;

        return { ...item, description: item.path };
      },
    },
  ];
}

function buildCoreQuickActionDefinitions(): QuickActionDefinition[] {
  const { navigation, power, account } = CORE_QUICK_ACTION_CATEGORIES;

  return [
    {
      id: 'general.goHome',
      category: navigation,
      label: () => getTranslations().t('pages.account.home.title', {}),
      icon: <FontAwesomeIcon icon={faServer} />,
      scopes: ['dashboard', 'server'],
      perform: (ctx) => ctx.navigate('/'),
    },
    {
      id: 'general.goAdmin',
      category: navigation,
      label: () => getTranslations().t('pages.account.admin.title', {}),
      icon: <FontAwesomeIcon icon={faGraduationCap} />,
      scopes: ['dashboard', 'server'],
      adminPermission: true,
      perform: (ctx) => ctx.navigate('/admin'),
    },
    {
      id: 'general.goBack',
      category: navigation,
      label: () => getTranslations().t('common.button.back', {}),
      icon: <FontAwesomeIcon icon={faReply} />,
      scopes: ['admin'],
      perform: (ctx) => ctx.navigate('/'),
    },
    {
      id: 'server.start',
      category: power,
      label: () => getTranslations().t('common.enum.serverPowerAction.start', {}),
      icon: <FontAwesomeIcon icon={faPlay} />,
      scopes: ['server'],
      permission: 'control.start',
      isVisible: (ctx) => ctx.serverState === 'offline',
      perform: (ctx) => ctx.socketInstance?.send(SocketRequest.SET_STATE, 'start'),
    },
    {
      id: 'server.stop',
      category: power,
      label: () => getTranslations().t('common.enum.serverPowerAction.stop', {}),
      icon: <FontAwesomeIcon icon={faStop} />,
      scopes: ['server'],
      permission: 'control.stop',
      isVisible: (ctx) => ctx.serverState !== 'offline' && ctx.serverState !== 'stopping',
      perform: (ctx) => ctx.socketInstance?.send(SocketRequest.SET_STATE, 'stop'),
    },
    {
      id: 'server.restart',
      category: power,
      label: () => getTranslations().t('common.enum.serverPowerAction.restart', {}),
      icon: <FontAwesomeIcon icon={faRotateRight} />,
      scopes: ['server'],
      permission: 'control.restart',
      isVisible: (ctx) => ctx.serverState === 'running',
      perform: (ctx) => ctx.socketInstance?.send(SocketRequest.SET_STATE, 'restart'),
    },
    {
      id: 'server.kill',
      category: power,
      label: () => getTranslations().t('common.enum.serverPowerAction.kill', {}),
      icon: <FontAwesomeIcon icon={faSkull} />,
      danger: true,
      scopes: ['server'],
      permission: 'control.stop',
      isVisible: (ctx) => ctx.serverState === 'stopping',
      perform: (ctx) => ctx.requestServerKill(),
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
      perform: (ctx) => ctx.requestLogout(),
    },
  ];
}
