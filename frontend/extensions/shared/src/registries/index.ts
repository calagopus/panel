import { ComponentListRegistry } from 'shared/src/registries/slices/componentList.ts';
import { ElementsRegistry } from './elements/index.ts';
import { PageRegistry } from './pages/index.ts';
import { PermissionIconRegistry } from './permission-icons.ts';
import { RouteRegistry } from './routes.ts';

export interface Registry {
  mergeFrom(other: this): this;
}

export class ExtensionRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.pages.mergeFrom(other.pages);
    this.elements.mergeFrom(other.elements);
    this.routes.mergeFrom(other.routes);
    this.permissionIcons.mergeFrom(other.permissionIcons);
    this.global.mergeFrom(other.global);

    return this;
  }

  public pages: PageRegistry = new PageRegistry();
  public elements: ElementsRegistry = new ElementsRegistry();
  public routes: RouteRegistry = new RouteRegistry();
  public permissionIcons: PermissionIconRegistry = new PermissionIconRegistry();
  public global: ComponentListRegistry = new ComponentListRegistry();

  public enterPages(callback: (registry: PageRegistry) => unknown): this {
    callback(this.pages);
    return this;
  }

  public enterElements(callback: (registry: ElementsRegistry) => unknown): this {
    callback(this.elements);
    return this;
  }

  public enterRoutes(callback: (registry: RouteRegistry) => unknown): this {
    callback(this.routes);
    return this;
  }

  public enterPermissionIcons(callback: (registry: PermissionIconRegistry) => unknown): this {
    callback(this.permissionIcons);
    return this;
  }

  public enterGlobal(callback: (registry: ComponentListRegistry) => unknown): this {
    callback(this.global);
    return this;
  }
}

export * from './pages/container.ts';
