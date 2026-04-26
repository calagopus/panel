import type { IconDefinition } from '@fortawesome/free-solid-svg-icons';
import type { FC } from 'react';

export interface GlobalRouteDefinition {
  path: string;
  filter?: () => boolean;
  matches?: (path: string) => boolean;
  element: FC;
  exact?: boolean;
}

export interface RouteDefinition extends GlobalRouteDefinition {
  name: string | (() => string) | undefined;
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
export * from './registries/index.ts';
export * from './translation.ts';
export * from './utils.ts';
