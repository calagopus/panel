import { Registry } from 'shared';
import { z } from 'zod';
import { adminMountSchema } from '@/lib/schemas/admin/mounts';
import { SubNavigationRegistry } from '../../../../slices/subNavigation.ts';
import { EggsRegistry } from './eggs.ts';
import { NodesRegistry } from './nodes.ts';
import { ServersRegistry } from './servers.ts';

export class ViewRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.subNavigation.mergeFrom(other.subNavigation);
    this.eggs.mergeFrom(other.eggs);
    this.nodes.mergeFrom(other.nodes);
    this.servers.mergeFrom(other.servers);

    return this;
  }

  /** @since 1.1.1 */
  public subNavigation = new SubNavigationRegistry<{ mount: z.infer<typeof adminMountSchema> }>();
  /** @since 1.1.1 */
  public eggs: EggsRegistry = new EggsRegistry();
  /** @since 1.1.1 */
  public nodes: NodesRegistry = new NodesRegistry();
  /** @since 1.1.1 */
  public servers: ServersRegistry = new ServersRegistry();

  /** @since 1.1.1 */
  public enterSubNavigation(
    callback: (registry: SubNavigationRegistry<{ mount: z.infer<typeof adminMountSchema> }>) => unknown,
  ): this {
    callback(this.subNavigation);
    return this;
  }

  /** @since 1.1.1 */
  public enterEggs(callback: (registry: EggsRegistry) => unknown): this {
    callback(this.eggs);
    return this;
  }

  /** @since 1.1.1 */
  public enterNodes(callback: (registry: NodesRegistry) => unknown): this {
    callback(this.nodes);
    return this;
  }

  /** @since 1.1.1 */
  public enterServers(callback: (registry: ServersRegistry) => unknown): this {
    callback(this.servers);
    return this;
  }
}
