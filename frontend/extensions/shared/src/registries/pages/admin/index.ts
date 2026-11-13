import type { FC } from 'react';
import { Registry } from 'shared';
import { ActivityRegistry } from './activity.ts';
import { AnnouncementsRegistry } from './announcements/index.ts';
import { BackupConfigurationsRegistry } from './backupConfigurations/index.ts';
import { DatabaseAgentHostsRegistry } from './databaseAgentHosts/index.ts';
import { DatabaseAgentTemplatesRegistry } from './databaseAgentTemplates/index.ts';
import { DatabaseHostsRegistry } from './databaseHosts/index.ts';
import { DevicesRegistry } from './devices/index.ts';
import { EggRepositoriesRegistry } from './eggRepositories/index.ts';
import { HomeRegistry } from './home/index.ts';
import { LocationsRegistry } from './locations/index.ts';
import { MountsRegistry } from './mounts/index.ts';
import { NodesRegistry } from './nodes/index.ts';
import { OAuthProvidersRegistry } from './oAuthProviders/index.ts';
import { RolesRegistry } from './roles/index.ts';
import { ServersRegistry } from './servers/index.ts';
import { SystemBackupPoliciesRegistry } from './systemBackupPolicies/index.ts';
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
    this.devices.mergeFrom(other.devices);
    this.announcements.mergeFrom(other.announcements);
    this.databaseHosts.mergeFrom(other.databaseHosts);
    this.oauthProviders.mergeFrom(other.oauthProviders);
    this.databaseAgentHosts.mergeFrom(other.databaseAgentHosts);
    this.databaseAgentTemplates.mergeFrom(other.databaseAgentTemplates);
    this.backupConfigurations.mergeFrom(other.backupConfigurations);
    this.systemBackupPolicies.mergeFrom(other.systemBackupPolicies);

    this.prependedComponents.push(...other.prependedComponents);
    this.appendedComponents.push(...other.appendedComponents);

    return this;
  }

  /** @since 1.1.1 */
  public home: HomeRegistry = new HomeRegistry();
  /** @since 1.1.1 */
  public activity: ActivityRegistry = new ActivityRegistry();
  /** @since 1.0.3 */
  public servers: ServersRegistry = new ServersRegistry();
  /** @since 1.1.0 */
  public nodes: NodesRegistry = new NodesRegistry();
  /** @since 1.1.1 */
  public locations: LocationsRegistry = new LocationsRegistry();
  /** @since 1.1.1 */
  public users: UsersRegistry = new UsersRegistry();
  /** @since 1.1.1 */
  public roles: RolesRegistry = new RolesRegistry();
  /** @since 1.1.1 */
  public eggRepositories: EggRepositoriesRegistry = new EggRepositoriesRegistry();
  /** @since 1.1.1 */
  public mounts: MountsRegistry = new MountsRegistry();
  /** @since 1.2.3 */
  public devices: DevicesRegistry = new DevicesRegistry();
  /** @since 1.1.1 */
  public announcements: AnnouncementsRegistry = new AnnouncementsRegistry();
  /** @since 1.1.1 */
  public databaseHosts: DatabaseHostsRegistry = new DatabaseHostsRegistry();
  /** @since 1.1.1 */
  public oauthProviders: OAuthProvidersRegistry = new OAuthProvidersRegistry();
  /** @since 1.1.1 */
  public databaseAgentHosts: DatabaseAgentHostsRegistry = new DatabaseAgentHostsRegistry();
  /** @since 1.1.1 */
  public databaseAgentTemplates: DatabaseAgentTemplatesRegistry = new DatabaseAgentTemplatesRegistry();
  /** @since 1.1.4 */
  public backupConfigurations: BackupConfigurationsRegistry = new BackupConfigurationsRegistry();
  /** @since 1.1.4 */
  public systemBackupPolicies: SystemBackupPoliciesRegistry = new SystemBackupPoliciesRegistry();

  /** @since 1.0.3 */
  public prependedComponents: FC[] = [];
  /** @since 1.0.3 */
  public appendedComponents: FC[] = [];

  /** @since 1.1.1 */
  public enterHome(callback: (registry: HomeRegistry) => unknown): this {
    callback(this.home);
    return this;
  }

  /** @since 1.1.1 */
  public enterActivity(callback: (registry: ActivityRegistry) => unknown): this {
    callback(this.activity);
    return this;
  }

  /** @since 1.1.1 */
  public enterLocations(callback: (registry: LocationsRegistry) => unknown): this {
    callback(this.locations);
    return this;
  }

  /** @since 1.1.1 */
  public enterUsers(callback: (registry: UsersRegistry) => unknown): this {
    callback(this.users);
    return this;
  }

  /** @since 1.1.1 */
  public enterRoles(callback: (registry: RolesRegistry) => unknown): this {
    callback(this.roles);
    return this;
  }

  /** @since 1.1.1 */
  public enterEggRepositories(callback: (registry: EggRepositoriesRegistry) => unknown): this {
    callback(this.eggRepositories);
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

  /** @since 1.1.1 */
  public enterAnnouncements(callback: (registry: AnnouncementsRegistry) => unknown): this {
    callback(this.announcements);
    return this;
  }

  /** @since 1.1.1 */
  public enterDatabaseHosts(callback: (registry: DatabaseHostsRegistry) => unknown): this {
    callback(this.databaseHosts);
    return this;
  }

  /** @since 1.1.1 */
  public enterOAuthProviders(callback: (registry: OAuthProvidersRegistry) => unknown): this {
    callback(this.oauthProviders);
    return this;
  }

  /** @since 1.1.1 */
  public enterDatabaseAgentHosts(callback: (registry: DatabaseAgentHostsRegistry) => unknown): this {
    callback(this.databaseAgentHosts);
    return this;
  }

  /** @since 1.1.1 */
  public enterDatabaseAgentTemplates(callback: (registry: DatabaseAgentTemplatesRegistry) => unknown): this {
    callback(this.databaseAgentTemplates);
    return this;
  }

  /** @since 1.1.4 */
  public enterBackupConfigurations(callback: (registry: BackupConfigurationsRegistry) => unknown): this {
    callback(this.backupConfigurations);
    return this;
  }

  /** @since 1.1.4 */
  public enterSystemBackupPolicies(callback: (registry: SystemBackupPoliciesRegistry) => unknown): this {
    callback(this.systemBackupPolicies);
    return this;
  }

  /** @since 1.0.3 */
  public enterServers(callback: (registry: ServersRegistry) => unknown): this {
    callback(this.servers);
    return this;
  }

  /** @since 1.1.0 */
  public enterNodes(callback: (registry: NodesRegistry) => unknown): this {
    callback(this.nodes);
    return this;
  }

  /** @since 1.0.3 */
  public prependComponent(component: FC): this {
    this.prependedComponents.push(component);
    return this;
  }

  /** @since 1.0.3 */
  public appendComponent(component: FC): this {
    this.appendedComponents.push(component);
    return this;
  }
}
