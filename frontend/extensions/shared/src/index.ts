import type { FC } from 'react';
import type { IconLike } from '@/elements/data-display/Icon.tsx';
import type { LazyString } from '@/lib/lazy.ts';

export interface GlobalRouteDefinition {
  path: string;
  filter?: () => boolean;
  matches?: (path: string) => boolean;
  element: FC;
  exact?: boolean;
}

export interface RouteDefinition extends GlobalRouteDefinition {
  name: LazyString | undefined;
  icon?: IconLike;
  activeMatches?: string[];
}

export interface AdminRouteDefinition extends RouteDefinition {
  permission?: string | string[] | null;
  category?: string;
}

export interface ServerRouteDefinition extends RouteDefinition {
  permission?: string | string[] | null;
}

export * from './events.ts';
export * from './extension.ts';
export * from './overrides.ts';
export * from './registries/forms/index.ts';
export * from './registries/index.ts';
export * from './translation.ts';
export * from './utils.ts';
