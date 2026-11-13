import { ComponentListRegistry } from 'shared/src/registries/slices/componentList.ts';
import { ElementsRegistry } from './elements/index.ts';
import { EventRegistry } from './events/index.ts';
import { FormRegistry } from './forms/index.ts';
import { PageRegistry } from './pages/index.ts';
import { PermissionIconRegistry } from './permission-icons.ts';
import { QuickActionRegistry } from './quickActions.ts';
import { RouteRegistry } from './routes.ts';
import { ShortcutRegistry } from './shortcuts.ts';

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
    this.shortcuts.mergeFrom(other.shortcuts);
    this.forms.mergeFrom(other.forms);
    this.quickActions.mergeFrom(other.quickActions);
    this.events.mergeFrom(other.events);

    return this;
  }

  /** @since 1.0.0 */
  public pages: PageRegistry = new PageRegistry();
  /** @since 1.0.0 */
  public elements: ElementsRegistry = new ElementsRegistry();
  /** @since 1.0.0 */
  public routes: RouteRegistry = new RouteRegistry();
  /** @since 1.0.0 */
  public permissionIcons: PermissionIconRegistry = new PermissionIconRegistry();
  /**
   * Mounted exactly once around the whole app, outside the auth and store providers.
   * @since 1.0.3
   */
  public global: ComponentListRegistry = new ComponentListRegistry();
  /** @since 1.0.10 */
  public shortcuts: ShortcutRegistry = new ShortcutRegistry();
  /** @since 1.1.0 */
  public forms: FormRegistry = new FormRegistry();
  /** @since 1.2.0 */
  public quickActions: QuickActionRegistry = new QuickActionRegistry();
  /** @since 1.2.6 */
  public events: EventRegistry = new EventRegistry();

  /** @since 1.0.0 */
  public enterPages(callback: (registry: PageRegistry) => unknown): this {
    callback(this.pages);
    return this;
  }

  /** @since 1.0.0 */
  public enterElements(callback: (registry: ElementsRegistry) => unknown): this {
    callback(this.elements);
    return this;
  }

  /** @since 1.0.0 */
  public enterRoutes(callback: (registry: RouteRegistry) => unknown): this {
    callback(this.routes);
    return this;
  }

  /** @since 1.0.0 */
  public enterPermissionIcons(callback: (registry: PermissionIconRegistry) => unknown): this {
    callback(this.permissionIcons);
    return this;
  }

  /** @since 1.0.3 */
  public enterGlobal(callback: (registry: ComponentListRegistry) => unknown): this {
    callback(this.global);
    return this;
  }

  /** @since 1.0.10 */
  public enterShortcuts(callback: (registry: ShortcutRegistry) => unknown): this {
    callback(this.shortcuts);
    return this;
  }

  /** @since 1.1.0 */
  public enterForms(callback: (registry: FormRegistry) => unknown): this {
    callback(this.forms);
    return this;
  }

  /** @since 1.2.0 */
  public enterQuickActions(callback: (registry: QuickActionRegistry) => unknown): this {
    callback(this.quickActions);
    return this;
  }

  /** @since 1.2.6 */
  public enterEvents(callback: (registry: EventRegistry) => unknown): this {
    callback(this.events);
    return this;
  }
}

export * from './events/index.ts';
export * from './pages/container.ts';
