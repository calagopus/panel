import { Registry } from 'shared';
import { z } from 'zod';
import { adminDatabaseHostSchema } from '@/lib/schemas/admin/databaseHosts';
import { SubNavigationRegistry } from '../../../../slices/subNavigation.ts';
import { DatabasesRegistry } from './databases.ts';

export class ViewRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.subNavigation.mergeFrom(other.subNavigation);
    this.databases.mergeFrom(other.databases);

    return this;
  }

  public subNavigation = new SubNavigationRegistry<{ databaseHost: z.infer<typeof adminDatabaseHostSchema> }>();
  public databases: DatabasesRegistry = new DatabasesRegistry();

  public enterSubNavigation(
    callback: (registry: SubNavigationRegistry<{ databaseHost: z.infer<typeof adminDatabaseHostSchema> }>) => unknown,
  ): this {
    callback(this.subNavigation);
    return this;
  }

  public enterDatabases(callback: (registry: DatabasesRegistry) => unknown): this {
    callback(this.databases);
    return this;
  }
}
