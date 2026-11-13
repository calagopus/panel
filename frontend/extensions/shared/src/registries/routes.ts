import { AdminRouteDefinition, GlobalRouteDefinition, Registry, RouteDefinition, ServerRouteDefinition } from 'shared';

type RouteInterceptor<I> = (items: I[]) => void;

export class RouteRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.globalRoutes.push(...other.globalRoutes);
    this.authenticationRoutes.push(...other.authenticationRoutes);
    this.accountRoutes.push(...other.accountRoutes);
    this.adminRoutes.push(...other.adminRoutes);
    this.serverRoutes.push(...other.serverRoutes);

    return this;
  }

  /**
   * Mounted at the top level, reachable whether logged in or not.
   * @since 1.0.0
   */
  public globalRoutes: GlobalRouteDefinition[] = [];
  /**
   * Interceptors mutate the merged stock and extension routes in place.
   * @since 1.0.2
   */
  public globalRouteInterceptors: RouteInterceptor<GlobalRouteDefinition>[] = [];
  /**
   * Mounted under `/auth`, only reachable while logged out.
   * @since 1.0.0
   */
  public authenticationRoutes: GlobalRouteDefinition[] = [];
  /**
   * Interceptors mutate the merged stock and extension routes in place.
   * @since 1.0.2
   */
  public authenticationRouteInterceptors: RouteInterceptor<GlobalRouteDefinition>[] = [];
  /**
   * Mounted in the dashboard, named ones also show in the account sidebar.
   * @since 1.0.0
   */
  public accountRoutes: RouteDefinition[] = [];
  /**
   * Interceptors mutate the merged stock and extension routes in place.
   * @since 1.0.2
   */
  public accountRouteInterceptors: RouteInterceptor<RouteDefinition>[] = [];
  /** @since 1.0.0 */
  public adminRoutes: AdminRouteDefinition[] = [];
  /**
   * Interceptors mutate the merged stock and extension routes in place.
   * @since 1.0.2
   */
  public adminRouteInterceptors: RouteInterceptor<AdminRouteDefinition>[] = [];
  /** @since 1.0.0 */
  public serverRoutes: ServerRouteDefinition[] = [];
  /**
   * Interceptors mutate the merged stock and extension routes in place.
   * @since 1.0.2
   */
  public serverRouteInterceptors: RouteInterceptor<ServerRouteDefinition>[] = [];

  /** @since 1.0.0 */
  public addGlobalRoute(route: GlobalRouteDefinition): this {
    this.globalRoutes.push(route);

    return this;
  }

  /** @since 1.0.2 */
  public addGlobalRouteInterceptor(interceptor: RouteInterceptor<GlobalRouteDefinition>): this {
    this.globalRouteInterceptors.push(interceptor);

    return this;
  }

  /** @since 1.0.0 */
  public addAuthenticationRoute(route: GlobalRouteDefinition): this {
    this.authenticationRoutes.push(route);

    return this;
  }

  /** @since 1.0.2 */
  public addAuthenticationRouteInterceptor(interceptor: RouteInterceptor<GlobalRouteDefinition>): this {
    this.authenticationRouteInterceptors.push(interceptor);

    return this;
  }

  /** @since 1.0.0 */
  public addAccountRoute(route: RouteDefinition): this {
    this.accountRoutes.push(route);

    return this;
  }

  /** @since 1.0.2 */
  public addAccountRouteInterceptor(interceptor: RouteInterceptor<RouteDefinition>): this {
    this.accountRouteInterceptors.push(interceptor);

    return this;
  }

  /** @since 1.0.0 */
  public addAdminRoute(route: AdminRouteDefinition): this {
    this.adminRoutes.push(route);

    return this;
  }

  /** @since 1.0.2 */
  public addAdminRouteInterceptor(interceptor: RouteInterceptor<AdminRouteDefinition>): this {
    this.adminRouteInterceptors.push(interceptor);

    return this;
  }

  /** @since 1.0.0 */
  public addServerRoute(route: ServerRouteDefinition): this {
    this.serverRoutes.push(route);

    return this;
  }

  /** @since 1.0.2 */
  public addServerRouteInterceptor(interceptor: RouteInterceptor<ServerRouteDefinition>): this {
    this.serverRouteInterceptors.push(interceptor);

    return this;
  }
}
