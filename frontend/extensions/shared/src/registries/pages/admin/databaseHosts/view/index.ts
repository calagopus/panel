import { Registry } from 'shared';
import { z } from 'zod';
import { adminDatabaseHostSchema } from '@/lib/schemas/admin/databaseHosts';
import { SubNavigationRegistry } from '../../../../slices/subNavigation.ts';
import { DatabasesRegistry } from './databases.ts';
import { OverviewRegistry } from './overview.ts';

export class ViewRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.subNavigation.mergeFrom(other.subNavigation);
    this.overview.mergeFrom(other.overview);
    this.databases.mergeFrom(other.databases);

    return this;
  }

  /** @since 1.1.1 */
  public subNavigation = new SubNavigationRegistry<{ databaseHost: z.infer<typeof adminDatabaseHostSchema> }>();
  /** @since 1.2.7 */
  public overview: OverviewRegistry = new OverviewRegistry();
  /** @since 1.1.1 */
  public databases: DatabasesRegistry = new DatabasesRegistry();

  /** @since 1.1.1 */
  public enterSubNavigation(
    callback: (registry: SubNavigationRegistry<{ databaseHost: z.infer<typeof adminDatabaseHostSchema> }>) => unknown,
  ): this {
    callback(this.subNavigation);
    return this;
  }

  /** @since 1.2.7 */
  public enterOverview(callback: (registry: OverviewRegistry) => unknown): this {
    callback(this.overview);
    return this;
  }

  /** @since 1.1.1 */
  public enterDatabases(callback: (registry: DatabasesRegistry) => unknown): this {
    callback(this.databases);
    return this;
  }
}
