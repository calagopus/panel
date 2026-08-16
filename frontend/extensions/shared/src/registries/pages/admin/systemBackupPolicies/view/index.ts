import { Registry } from 'shared';
import { z } from 'zod';
import { adminSystemBackupPolicySchema } from '@/lib/schemas/admin/systemBackupPolicies.ts';
import { SubNavigationRegistry } from '../../../../slices/subNavigation.ts';
import { BackupsRegistry } from './backups.ts';
import { LocationsRegistry } from './locations.ts';
import { NodesRegistry } from './nodes.ts';
import { ServersRegistry } from './servers.ts';

export class ViewRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.subNavigation.mergeFrom(other.subNavigation);
    this.backups.mergeFrom(other.backups);
    this.locations.mergeFrom(other.locations);
    this.nodes.mergeFrom(other.nodes);
    this.servers.mergeFrom(other.servers);

    return this;
  }

  public subNavigation = new SubNavigationRegistry<{
    systemBackupPolicy: z.infer<typeof adminSystemBackupPolicySchema>;
  }>();
  public backups: BackupsRegistry = new BackupsRegistry();
  public locations: LocationsRegistry = new LocationsRegistry();
  public nodes: NodesRegistry = new NodesRegistry();
  public servers: ServersRegistry = new ServersRegistry();

  public enterSubNavigation(
    callback: (
      registry: SubNavigationRegistry<{ systemBackupPolicy: z.infer<typeof adminSystemBackupPolicySchema> }>,
    ) => unknown,
  ): this {
    callback(this.subNavigation);
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
