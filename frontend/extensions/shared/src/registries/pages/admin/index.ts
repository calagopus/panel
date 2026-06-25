import type { FC } from 'react';
import { Registry } from 'shared';
import { NodesRegistry } from './nodes/index.ts';
import { ServersRegistry } from './servers/index.ts';

export class AdminRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.servers.mergeFrom(other.servers);
    this.nodes.mergeFrom(other.nodes);

    this.prependedComponents.push(...other.prependedComponents);
    this.appendedComponents.push(...other.appendedComponents);

    return this;
  }

  public servers: ServersRegistry = new ServersRegistry();
  public nodes: NodesRegistry = new NodesRegistry();

  public prependedComponents: FC[] = [];
  public appendedComponents: FC[] = [];

  public enterServers(callback: (registry: ServersRegistry) => unknown): this {
    callback(this.servers);
    return this;
  }

  public enterNodes(callback: (registry: NodesRegistry) => unknown): this {
    callback(this.nodes);
    return this;
  }

  public prependComponent(component: FC): this {
    this.prependedComponents.push(component);
    return this;
  }

  public appendComponent(component: FC): this {
    this.appendedComponents.push(component);
    return this;
  }
}
