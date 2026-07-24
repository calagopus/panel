import type { FC } from 'react';
import { Registry } from 'shared';
import { ActivityRegistry } from './activity.ts';
import { AnnouncementsRegistry } from './announcements/index.ts';
import { DatabaseAgentHostsRegistry } from './databaseAgentHosts/index.ts';
import { DatabaseAgentTemplatesRegistry } from './databaseAgentTemplates/index.ts';
import { DatabaseHostsRegistry } from './databaseHosts/index.ts';
import { EggRepositoriesRegistry } from './eggRepositories/index.ts';
import { HomeRegistry } from './home/index.ts';
import { LocationsRegistry } from './locations/index.ts';
import { MountsRegistry } from './mounts/index.ts';
import { NodesRegistry } from './nodes/index.ts';
import { OAuthProvidersRegistry } from './oAuthProviders/index.ts';
import { RolesRegistry } from './roles/index.ts';
import { ServersRegistry } from './servers/index.ts';
import { UsersRegistry } from './users/index.ts';

export class AdminRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.home.mergeFrom(other.home);
    this.activity.mergeFrom(other.activity);
    this.servers.mergeFrom(other.servers);
    this.nodes.mergeFrom(other.nodes);
    this.locations.mergeFrom(other.locations);
    this.users.mergeFrom(other.users);
    this.roles.mergeFrom(other.roles);
    this.eggRepositories.mergeFrom(other.eggRepositories);
    this.mounts.mergeFrom(other.mounts);
    this.announcements.mergeFrom(other.announcements);
    this.databaseHosts.mergeFrom(other.databaseHosts);
    this.oauthProviders.mergeFrom(other.oauthProviders);
    this.databaseAgentHosts.mergeFrom(other.databaseAgentHosts);
    this.databaseAgentTemplates.mergeFrom(other.databaseAgentTemplates);

    this.prependedComponents.push(...other.prependedComponents);
    this.appendedComponents.push(...other.appendedComponents);

    return this;
  }

  public home: HomeRegistry = new HomeRegistry();
  public activity: ActivityRegistry = new ActivityRegistry();
  public servers: ServersRegistry = new ServersRegistry();
  public nodes: NodesRegistry = new NodesRegistry();
  public locations: LocationsRegistry = new LocationsRegistry();
  public users: UsersRegistry = new UsersRegistry();
  public roles: RolesRegistry = new RolesRegistry();
  public eggRepositories: EggRepositoriesRegistry = new EggRepositoriesRegistry();
  public mounts: MountsRegistry = new MountsRegistry();
  public announcements: AnnouncementsRegistry = new AnnouncementsRegistry();
  public databaseHosts: DatabaseHostsRegistry = new DatabaseHostsRegistry();
  public oauthProviders: OAuthProvidersRegistry = new OAuthProvidersRegistry();
  public databaseAgentHosts: DatabaseAgentHostsRegistry = new DatabaseAgentHostsRegistry();
  public databaseAgentTemplates: DatabaseAgentTemplatesRegistry = new DatabaseAgentTemplatesRegistry();

  public prependedComponents: FC[] = [];
  public appendedComponents: FC[] = [];

  public enterHome(callback: (registry: HomeRegistry) => unknown): this {
    callback(this.home);
    return this;
  }

  public enterActivity(callback: (registry: ActivityRegistry) => unknown): this {
    callback(this.activity);
    return this;
  }

  public enterLocations(callback: (registry: LocationsRegistry) => unknown): this {
    callback(this.locations);
    return this;
  }

  public enterUsers(callback: (registry: UsersRegistry) => unknown): this {
    callback(this.users);
    return this;
  }

  public enterRoles(callback: (registry: RolesRegistry) => unknown): this {
    callback(this.roles);
    return this;
  }

  public enterEggRepositories(callback: (registry: EggRepositoriesRegistry) => unknown): this {
    callback(this.eggRepositories);
    return this;
  }

  public enterMounts(callback: (registry: MountsRegistry) => unknown): this {
    callback(this.mounts);
    return this;
  }

  public enterAnnouncements(callback: (registry: AnnouncementsRegistry) => unknown): this {
    callback(this.announcements);
    return this;
  }

  public enterDatabaseHosts(callback: (registry: DatabaseHostsRegistry) => unknown): this {
    callback(this.databaseHosts);
    return this;
  }

  public enterOAuthProviders(callback: (registry: OAuthProvidersRegistry) => unknown): this {
    callback(this.oauthProviders);
    return this;
  }

  public enterDatabaseAgentHosts(callback: (registry: DatabaseAgentHostsRegistry) => unknown): this {
    callback(this.databaseAgentHosts);
    return this;
  }

  public enterDatabaseAgentTemplates(callback: (registry: DatabaseAgentTemplatesRegistry) => unknown): this {
    callback(this.databaseAgentTemplates);
    return this;
  }

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
