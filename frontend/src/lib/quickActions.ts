import type { ReactNode } from 'react';
import type { NavigateFunction } from 'react-router';
import type { z } from 'zod';
import type { LazyString } from '@/lib/lazy.ts';
import type { serverPowerState, serverSchema } from '@/lib/schemas/server/server.ts';
import type { fullUserSchema } from '@/lib/schemas/user.ts';
import type { Websocket } from '@/plugins/Websocket.ts';
import type { AddToast } from '@/providers/contexts/toastContext.ts';

export type QuickActionScope = 'dashboard' | 'server' | 'admin';

export interface QuickActionCategory {
  id: string;
  label: LazyString;
  icon?: ReactNode;
  /** Lower sorts first; categories without one fall back to alphabetical order by label. */
  order?: number;
}

export interface QuickActionContext {
  scope: QuickActionScope;
  navigate: NavigateFunction;
  close: () => void;
  user: z.infer<typeof fullUserSchema> | null;
  server: z.infer<typeof serverSchema> | null;
  serverState: z.infer<typeof serverPowerState> | null;
  socketInstance: Websocket | null;
  doLogout: () => void;
  canServer: (action: string | string[], matchAny?: boolean) => boolean;
  requestServerKill: () => void;
  requestLogout: () => void;
}

export interface QuickActionItem {
  key: string;
  category: string;
  label: string;
  description?: string;
  path?: string;
  keywords?: string[];
  icon?: ReactNode;
  danger?: boolean;
  onSelect: () => void;
}

export interface QuickActionModeContext {
  term: string;
  close: () => void;
  addToast: AddToast;
  refresh: () => void;
}

export interface QuickActionMode {
  id: string;
  prefix: string;
  hint: LazyString;
  prepare?: (ctx: QuickActionModeContext) => void;
  items?: (ctx: QuickActionModeContext) => QuickActionItem[];
  map?: (item: QuickActionItem, ctx: QuickActionModeContext) => QuickActionItem | null;
}

export interface QuickActionDefinition {
  id: string;
  category: string;
  label: LazyString;
  description?: LazyString;
  keywords?: string[];
  icon?: ReactNode;
  scopes?: QuickActionScope[];
  permission?: string | string[];
  adminPermission?: string | true;
  danger?: boolean;
  isVisible?: (ctx: QuickActionContext) => boolean;
  perform: (ctx: QuickActionContext) => void;
}
