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

  public globalRoutes: GlobalRouteDefinition[] = [];
  public globalRouteInterceptors: RouteInterceptor<GlobalRouteDefinition>[] = [];
  public authenticationRoutes: GlobalRouteDefinition[] = [];
  public authenticationRouteInterceptors: RouteInterceptor<GlobalRouteDefinition>[] = [];
  public accountRoutes: RouteDefinition[] = [];
  public accountRouteInterceptors: RouteInterceptor<RouteDefinition>[] = [];
  public adminRoutes: AdminRouteDefinition[] = [];
  public adminRouteInterceptors: RouteInterceptor<AdminRouteDefinition>[] = [];
  public serverRoutes: ServerRouteDefinition[] = [];
  public serverRouteInterceptors: RouteInterceptor<ServerRouteDefinition>[] = [];

  public addGlobalRoute(route: GlobalRouteDefinition): this {
    this.globalRoutes.push(route);

    return this;
  }

  public addGlobalRouteInterceptor(interceptor: RouteInterceptor<GlobalRouteDefinition>): this {
    this.globalRouteInterceptors.push(interceptor);

    return this;
  }

  public addAuthenticationRoute(route: GlobalRouteDefinition): this {
    this.authenticationRoutes.push(route);

    return this;
  }

  public addAuthenticationRouteInterceptor(interceptor: RouteInterceptor<GlobalRouteDefinition>): this {
    this.authenticationRouteInterceptors.push(interceptor);

    return this;
  }

  public addAccountRoute(route: RouteDefinition): this {
    this.accountRoutes.push(route);

    return this;
  }

  public addAccountRouteInterceptor(interceptor: RouteInterceptor<RouteDefinition>): this {
    this.accountRouteInterceptors.push(interceptor);

    return this;
  }

  public addAdminRoute(route: AdminRouteDefinition): this {
    this.adminRoutes.push(route);

    return this;
  }

  public addAdminRouteInterceptor(interceptor: RouteInterceptor<AdminRouteDefinition>): this {
    this.adminRouteInterceptors.push(interceptor);

    return this;
  }

  public addServerRoute(route: ServerRouteDefinition): this {
    this.serverRoutes.push(route);

    return this;
  }

  public addServerRouteInterceptor(interceptor: RouteInterceptor<ServerRouteDefinition>): this {
    this.serverRouteInterceptors.push(interceptor);

    return this;
  }
}
