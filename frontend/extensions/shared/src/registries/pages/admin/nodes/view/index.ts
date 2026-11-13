import { Registry } from 'shared';
import { z } from 'zod';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes';
import { SubNavigationRegistry } from '../../../../slices/subNavigation.ts';
import { AllocationsRegistry } from './allocations.ts';
import { BackupsRegistry } from './backups.ts';
import { ConfigurationRegistry } from './configuration.ts';
import { DatabaseAgentHostsRegistry } from './databaseAgentHosts.ts';
import { DatabaseHostsRegistry } from './databaseHosts.ts';
import { DevicesRegistry } from './devices.ts';
import { LogsRegistry } from './logs.ts';
import { MountsRegistry } from './mounts.ts';
import { OverviewRegistry } from './overview.ts';
import { ServersRegistry } from './servers.ts';
import { StatisticsRegistry } from './statistics.ts';
import { TransfersRegistry } from './transfers.ts';

export class ViewRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.subNavigation.mergeFrom(other.subNavigation);
    this.overview.mergeFrom(other.overview);
    this.configuration.mergeFrom(other.configuration);
    this.statistics.mergeFrom(other.statistics);
    this.logs.mergeFrom(other.logs);
    this.allocations.mergeFrom(other.allocations);
    this.mounts.mergeFrom(other.mounts);
    this.devices.mergeFrom(other.devices);
    this.databaseHosts.mergeFrom(other.databaseHosts);
    this.databaseAgentHosts.mergeFrom(other.databaseAgentHosts);
    this.backups.mergeFrom(other.backups);
    this.servers.mergeFrom(other.servers);
    this.transfers.mergeFrom(other.transfers);

    return this;
  }

  /** @since 1.1.1 */
  public subNavigation = new SubNavigationRegistry<{ node: z.infer<typeof adminNodeSchema> }>();
  /** @since 1.1.0 */
  public overview: OverviewRegistry = new OverviewRegistry();
  /** @since 1.1.1 */
  public configuration: ConfigurationRegistry = new ConfigurationRegistry();
  /** @since 1.1.1 */
  public statistics: StatisticsRegistry = new StatisticsRegistry();
  /** @since 1.1.1 */
  public logs: LogsRegistry = new LogsRegistry();
  /** @since 1.1.1 */
  public allocations: AllocationsRegistry = new AllocationsRegistry();
  /** @since 1.1.1 */
  public mounts: MountsRegistry = new MountsRegistry();
  /** @since 1.2.3 */
  public devices: DevicesRegistry = new DevicesRegistry();
  /** @since 1.1.2 */
  public databaseHosts: DatabaseHostsRegistry = new DatabaseHostsRegistry();
  /** @since 1.1.2 */
  public databaseAgentHosts: DatabaseAgentHostsRegistry = new DatabaseAgentHostsRegistry();
  /** @since 1.1.1 */
  public backups: BackupsRegistry = new BackupsRegistry();
  /** @since 1.1.1 */
  public servers: ServersRegistry = new ServersRegistry();
  /** @since 1.1.1 */
  public transfers: TransfersRegistry = new TransfersRegistry();

  /** @since 1.1.1 */
  public enterSubNavigation(
    callback: (registry: SubNavigationRegistry<{ node: z.infer<typeof adminNodeSchema> }>) => unknown,
  ): this {
    callback(this.subNavigation);
    return this;
  }

  /** @since 1.1.0 */
  public enterOverview(callback: (registry: OverviewRegistry) => unknown): this {
    callback(this.overview);
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

  /** @since 1.1.1 */
  public enterLogs(callback: (registry: LogsRegistry) => unknown): this {
    callback(this.logs);
    return this;
  }

  /** @since 1.1.1 */
  public enterAllocations(callback: (registry: AllocationsRegistry) => unknown): this {
    callback(this.allocations);
    return this;
  }

  /** @since 1.1.1 */
  public enterMounts(callback: (registry: MountsRegistry) => unknown): this {
    callback(this.mounts);
    return this;
  }

  /** @since 1.2.3 */
  public enterDevices(callback: (registry: DevicesRegistry) => unknown): this {
    callback(this.devices);
    return this;
  }

  /** @since 1.1.2 */
  public enterDatabaseHosts(callback: (registry: DatabaseHostsRegistry) => unknown): this {
    callback(this.databaseHosts);
    return this;
  }

  /** @since 1.1.2 */
  public enterDatabaseAgentHosts(callback: (registry: DatabaseAgentHostsRegistry) => unknown): this {
    callback(this.databaseAgentHosts);
    return this;
  }

  /** @since 1.1.1 */
  public enterBackups(callback: (registry: BackupsRegistry) => unknown): this {
    callback(this.backups);
    return this;
  }

  /** @since 1.1.1 */
  public enterServers(callback: (registry: ServersRegistry) => unknown): this {
    callback(this.servers);
    return this;
  }

  /** @since 1.1.1 */
  public enterTransfers(callback: (registry: TransfersRegistry) => unknown): this {
    callback(this.transfers);
    return this;
  }
}
