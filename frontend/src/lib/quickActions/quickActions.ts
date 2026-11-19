import type { ReactNode } from 'react';
import type { IconLike } from '@/elements/data-display/Icon.tsx';
import type { LazyString } from '@/lib/lazy.ts';

export type QuickActionScope = 'dashboard' | 'server' | 'admin';

export interface QuickActionCategory {
  id: string;
  label: LazyString;
  icon?: IconLike;
  /** Lower sorts first; categories without one fall back to alphabetical order by label. */
  order?: number;
}

export interface QuickActionItem {
  key: string;
  category: string;
  label: string;
  description?: string;
  /** Rendered under the label, for anything a string cannot express - an avatar, a badge, a status. */
  content?: ReactNode;
  path?: string;
  keywords?: string[];
  icon?: IconLike;
  danger?: boolean;
  onSelect: () => void;
}

export interface QuickActionMode {
  id: string;
  prefix: string;
  hint: LazyString;
  /** Rows the mode contributes on top of the regular ones. */
  items?: QuickActionItem[];
  /** Runs over every regular row while the mode is active, returning null to drop it. */
  map?: (item: QuickActionItem) => QuickActionItem | null;
  loading?: boolean;
}

export interface QuickActionDefinition {
  id: string;
  category: string;
  label: LazyString;
  description?: LazyString;
  /** Rendered under the label, for anything a string cannot express - an avatar, a badge, a status. */
  content?: ReactNode;
  path?: string;
  keywords?: string[];
  icon?: IconLike;
  scopes?: QuickActionScope[];
  permission?: string | string[];
  adminPermission?: string | true;
  danger?: boolean;
  isVisible?: () => boolean;
  perform: () => void;
}
