import type { IconDefinition } from '@fortawesome/free-solid-svg-icons';
import type { FC } from 'react';
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
  icon?: IconDefinition;
  activeMatches?: string[];
}

export interface AdminRouteDefinition extends RouteDefinition {
  permission?: string | string[] | null;
}

export interface ServerRouteDefinition extends RouteDefinition {
  permission?: string | string[] | null;
}

export * from './extension.ts';
export * from './overrides.ts';
export * from './registries/forms/index.ts';
export * from './registries/index.ts';
export * from './translation.ts';
export * from './utils.ts';
