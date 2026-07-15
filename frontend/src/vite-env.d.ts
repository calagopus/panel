/// <reference types="vite/client" />

import type { ExtensionContext } from 'shared';
import { databaseType } from '@/lib/schemas/generic.ts';

declare global {
  interface Window {
    extensionContext: ExtensionContext;
    grecaptcha: mixed;
  }

  type AndCreated<T extends object> = T & {
    created: Date;
  };

  interface Pagination<T> {
    total: number;
    perPage: number;
    page: number;
    data: T[];
  }

  type GroupedDatabaseHosts = {
    [key in z.infer<typeof databaseType>]: {
      group: string;
      items: { value: string; label: string; disabled?: boolean }[];
    };
  };
}
