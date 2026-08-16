import { Registry } from 'shared';
import { z } from 'zod';
import { adminBackupConfigurationSchema } from '@/lib/schemas/admin/backupConfigurations.ts';
import { SubNavigationRegistry } from '../../../../slices/subNavigation.ts';
import { BackupsRegistry } from './backups.ts';
import { LocationsRegistry } from './locations.ts';
import { NodesRegistry } from './nodes.ts';
import { ServersRegistry } from './servers.ts';
import { StatsRegistry } from './stats.ts';

export class ViewRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.subNavigation.mergeFrom(other.subNavigation);
    this.stats.mergeFrom(other.stats);
    this.backups.mergeFrom(other.backups);
    this.locations.mergeFrom(other.locations);
    this.nodes.mergeFrom(other.nodes);
    this.servers.mergeFrom(other.servers);

    return this;
  }

  public subNavigation = new SubNavigationRegistry<{
    backupConfiguration: z.infer<typeof adminBackupConfigurationSchema>;
  }>();
  public stats: StatsRegistry = new StatsRegistry();
  public backups: BackupsRegistry = new BackupsRegistry();
  public locations: LocationsRegistry = new LocationsRegistry();
  public nodes: NodesRegistry = new NodesRegistry();
  public servers: ServersRegistry = new ServersRegistry();

  public enterSubNavigation(
    callback: (
      registry: SubNavigationRegistry<{ backupConfiguration: z.infer<typeof adminBackupConfigurationSchema> }>,
    ) => unknown,
  ): this {
    callback(this.subNavigation);
    return this;
  }

  public enterStats(callback: (registry: StatsRegistry) => unknown): this {
    callback(this.stats);
    return this;
  }

  public enterBackups(callback: (registry: BackupsRegistry) => unknown): this {
    callback(this.backups);
    return this;
  }

  public enterLocations(callback: (registry: LocationsRegistry) => unknown): this {
    callback(this.locations);
    return this;
  }

  public enterNodes(callback: (registry: NodesRegistry) => unknown): this {
    callback(this.nodes);
    return this;
  }

  public enterServers(callback: (registry: ServersRegistry) => unknown): this {
    callback(this.servers);
    return this;
  }
}
