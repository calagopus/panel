import type { IconDefinition } from '@fortawesome/free-solid-svg-icons';
import type { ReactNode } from 'react';
import type { NavigateFunction } from 'react-router';
import type { z } from 'zod';
import type { LazyString } from '@/lib/lazy.ts';
import type { serverPowerState, serverSchema } from '@/lib/schemas/server/server.ts';
import type { fullUserSchema } from '@/lib/schemas/user.ts';
import type { Websocket } from '@/plugins/Websocket.ts';

export type QuickActionScope = 'dashboard' | 'server';

export interface QuickActionCategory {
  id: string;
  label: () => string;
  icon?: ReactNode;
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
}

export interface QuickActionDefinition {
  id: string;
  category: string;
  label: LazyString;
  keywords?: string[];
  icon?: IconDefinition;
  /** Scopes this action can appear in. Omit to allow it everywhere. */
  scopes?: QuickActionScope[];
  /** Server permission(s) required. */
  permission?: string | string[];
  /** `true` requires only the admin flag, a string requires that specific admin permission. */
  adminPermission?: string | true;
  danger?: boolean;
  isVisible?: (ctx: QuickActionContext) => boolean;
  perform: (ctx: QuickActionContext) => void;
}
