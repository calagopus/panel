import { Registry } from 'shared';
import { z } from 'zod';
import { adminDatabaseAgentHostSchema } from '@/lib/schemas/admin/databaseAgentHosts';
import { SubNavigationRegistry } from '../../../../slices/subNavigation.ts';
import { BackupsRegistry } from './backups.ts';
import { ConfigurationRegistry } from './configuration.ts';
import { InstancesRegistry } from './instances.ts';
import { OverviewRegistry } from './overview.ts';
import { StatisticsRegistry } from './statistics.ts';

export class ViewRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.subNavigation.mergeFrom(other.subNavigation);
    this.overview.mergeFrom(other.overview);
    this.backups.mergeFrom(other.backups);
    this.instances.mergeFrom(other.instances);
    this.configuration.mergeFrom(other.configuration);
    this.statistics.mergeFrom(other.statistics);

    return this;
  }

  /** @since 1.1.1 */
  public subNavigation = new SubNavigationRegistry<{
    databaseAgentHost: z.infer<typeof adminDatabaseAgentHostSchema>;
  }>();
  /** @since 1.1.1 */
  public overview: OverviewRegistry = new OverviewRegistry();
  /** @since 1.2.1 */
  public backups: BackupsRegistry = new BackupsRegistry();
  /** @since 1.1.1 */
  public instances: InstancesRegistry = new InstancesRegistry();
  /** @since 1.1.1 */
  public configuration: ConfigurationRegistry = new ConfigurationRegistry();
  /** @since 1.1.1 */
  public statistics: StatisticsRegistry = new StatisticsRegistry();

  /** @since 1.1.1 */
  public enterSubNavigation(
    callback: (
      registry: SubNavigationRegistry<{ databaseAgentHost: z.infer<typeof adminDatabaseAgentHostSchema> }>,
    ) => unknown,
  ): this {
    callback(this.subNavigation);
    return this;
  }

  /** @since 1.1.1 */
  public enterOverview(callback: (registry: OverviewRegistry) => unknown): this {
    callback(this.overview);
    return this;
  }

  /** @since 1.2.1 */
  public enterBackups(callback: (registry: BackupsRegistry) => unknown): this {
    callback(this.backups);
    return this;
  }

  /** @since 1.1.1 */
  public enterInstances(callback: (registry: InstancesRegistry) => unknown): this {
    callback(this.instances);
    return this;
  }

  /** @since 1.1.1 */
  public enterConfiguration(callback: (registry: ConfigurationRegistry) => unknown): this {
    callback(this.configuration);
    return this;
  }

  /** @since 1.1.1 */
  public enterStatistics(callback: (registry: StatisticsRegistry) => unknown): this {
    callback(this.statistics);
    return this;
  }
}
