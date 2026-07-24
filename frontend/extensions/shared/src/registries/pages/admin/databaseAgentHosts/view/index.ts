import { Registry } from 'shared';
import { z } from 'zod';
import { adminDatabaseAgentHostSchema } from '@/lib/schemas/admin/databaseAgentHosts';
import { SubNavigationRegistry } from '../../../../slices/subNavigation.ts';
import { ConfigurationRegistry } from './configuration.ts';
import { InstancesRegistry } from './instances.ts';
import { OverviewRegistry } from './overview.ts';
import { StatisticsRegistry } from './statistics.ts';

export class ViewRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.subNavigation.mergeFrom(other.subNavigation);
    this.overview.mergeFrom(other.overview);
    this.instances.mergeFrom(other.instances);
    this.configuration.mergeFrom(other.configuration);
    this.statistics.mergeFrom(other.statistics);

    return this;
  }

  public subNavigation = new SubNavigationRegistry<{
    databaseAgentHost: z.infer<typeof adminDatabaseAgentHostSchema>;
  }>();
  public overview: OverviewRegistry = new OverviewRegistry();
  public instances: InstancesRegistry = new InstancesRegistry();
  public configuration: ConfigurationRegistry = new ConfigurationRegistry();
  public statistics: StatisticsRegistry = new StatisticsRegistry();

  public enterSubNavigation(
    callback: (
      registry: SubNavigationRegistry<{ databaseAgentHost: z.infer<typeof adminDatabaseAgentHostSchema> }>,
    ) => unknown,
  ): this {
    callback(this.subNavigation);
    return this;
  }

  public enterOverview(callback: (registry: OverviewRegistry) => unknown): this {
    callback(this.overview);
    return this;
  }

  public enterInstances(callback: (registry: InstancesRegistry) => unknown): this {
    callback(this.instances);
    return this;
  }

  public enterConfiguration(callback: (registry: ConfigurationRegistry) => unknown): this {
    callback(this.configuration);
    return this;
  }

  public enterStatistics(callback: (registry: StatisticsRegistry) => unknown): this {
    callback(this.statistics);
    return this;
  }
}
