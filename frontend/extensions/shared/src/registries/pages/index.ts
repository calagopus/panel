import { Registry } from 'shared';
import { AdminRegistry } from './admin/index.ts';
import { AuthRegistry } from './auth/index.ts';
import { DashboardRegistry } from './dashboard/index.ts';
import { GlobalRegistry } from './global.ts';
import { ServerRegistry } from './server/index.ts';

export class PageRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.global.mergeFrom(other.global);
    this.auth.mergeFrom(other.auth);
    this.dashboard.mergeFrom(other.dashboard);
    this.server.mergeFrom(other.server);
    this.admin.mergeFrom(other.admin);

    return this;
  }

  public global: GlobalRegistry = new GlobalRegistry();
  public auth: AuthRegistry = new AuthRegistry();
  public dashboard: DashboardRegistry = new DashboardRegistry();
  public server: ServerRegistry = new ServerRegistry();
  public admin: AdminRegistry = new AdminRegistry();

  public enterGlobal(callback: (registry: GlobalRegistry) => unknown): this {
    callback(this.global);
    return this;
  }

  public enterAuth(callback: (registry: AuthRegistry) => unknown): this {
    callback(this.auth);
    return this;
  }

  public enterDashboard(callback: (registry: DashboardRegistry) => unknown): this {
    callback(this.dashboard);
    return this;
  }

  public enterServer(callback: (registry: ServerRegistry) => unknown): this {
    callback(this.server);
    return this;
  }

  public enterAdmin(callback: (registry: AdminRegistry) => unknown): this {
    callback(this.admin);
    return this;
  }
}
