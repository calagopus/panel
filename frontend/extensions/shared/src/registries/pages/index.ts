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

  /** @since 1.0.0 */
  public global: GlobalRegistry = new GlobalRegistry();
  /** @since 1.1.1 */
  public auth: AuthRegistry = new AuthRegistry();
  /** @since 1.0.0 */
  public dashboard: DashboardRegistry = new DashboardRegistry();
  /** @since 1.0.0 */
  public server: ServerRegistry = new ServerRegistry();
  /** @since 1.0.3 */
  public admin: AdminRegistry = new AdminRegistry();

  /** @since 1.0.0 */
  public enterGlobal(callback: (registry: GlobalRegistry) => unknown): this {
    callback(this.global);
    return this;
  }

  /** @since 1.1.1 */
  public enterAuth(callback: (registry: AuthRegistry) => unknown): this {
    callback(this.auth);
    return this;
  }

  /** @since 1.0.0 */
  public enterDashboard(callback: (registry: DashboardRegistry) => unknown): this {
    callback(this.dashboard);
    return this;
  }

  /** @since 1.0.0 */
  public enterServer(callback: (registry: ServerRegistry) => unknown): this {
    callback(this.server);
    return this;
  }

  /** @since 1.0.3 */
  public enterAdmin(callback: (registry: AdminRegistry) => unknown): this {
    callback(this.admin);
    return this;
  }
}
