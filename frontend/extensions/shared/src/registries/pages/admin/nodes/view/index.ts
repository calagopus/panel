import { Registry } from 'shared';
import { z } from 'zod';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes';
import { SubNavigationRegistry } from '../../../../slices/subNavigation.ts';
import { AllocationsRegistry } from './allocations.ts';
import { BackupsRegistry } from './backups.ts';
import { ConfigurationRegistry } from './configuration.ts';
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
    this.backups.mergeFrom(other.backups);
    this.servers.mergeFrom(other.servers);
    this.transfers.mergeFrom(other.transfers);

    return this;
  }

  public subNavigation = new SubNavigationRegistry<{ node: z.infer<typeof adminNodeSchema> }>();
  public overview: OverviewRegistry = new OverviewRegistry();
  public configuration: ConfigurationRegistry = new ConfigurationRegistry();
  public statistics: StatisticsRegistry = new StatisticsRegistry();
  public logs: LogsRegistry = new LogsRegistry();
  public allocations: AllocationsRegistry = new AllocationsRegistry();
  public mounts: MountsRegistry = new MountsRegistry();
  public backups: BackupsRegistry = new BackupsRegistry();
  public servers: ServersRegistry = new ServersRegistry();
  public transfers: TransfersRegistry = new TransfersRegistry();

  public enterSubNavigation(
    callback: (registry: SubNavigationRegistry<{ node: z.infer<typeof adminNodeSchema> }>) => unknown,
  ): this {
    callback(this.subNavigation);
    return this;
  }

  public enterOverview(callback: (registry: OverviewRegistry) => unknown): this {
    callback(this.overview);
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

  public enterLogs(callback: (registry: LogsRegistry) => unknown): this {
    callback(this.logs);
    return this;
  }

  public enterAllocations(callback: (registry: AllocationsRegistry) => unknown): this {
    callback(this.allocations);
    return this;
  }

  public enterMounts(callback: (registry: MountsRegistry) => unknown): this {
    callback(this.mounts);
    return this;
  }

  public enterBackups(callback: (registry: BackupsRegistry) => unknown): this {
    callback(this.backups);
    return this;
  }

  public enterServers(callback: (registry: ServersRegistry) => unknown): this {
    callback(this.servers);
    return this;
  }

  public enterTransfers(callback: (registry: TransfersRegistry) => unknown): this {
    callback(this.transfers);
    return this;
  }
}
