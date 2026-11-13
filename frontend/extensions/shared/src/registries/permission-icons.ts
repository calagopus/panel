import type { ReactNode } from 'react';
import { Registry } from 'shared';

export class PermissionIconRegistry implements Registry {
  /**
   * Keyed by permission group, the part before the dot. Used for API keys.
   * @since 1.0.0
   */
  public userPermissionIcons: Record<string, ReactNode> = {};
  /**
   * Keyed by permission group, the part before the dot.
   * @since 1.0.0
   */
  public adminPermissionIcons: Record<string, ReactNode> = {};
  /**
   * Keyed by permission group, the part before the dot.
   * @since 1.0.0
   */
  public serverPermissionIcons: Record<string, ReactNode> = {};

  public mergeFrom(other: this): this {
    for (const [k, v] of Object.entries(other.userPermissionIcons)) {
      this.userPermissionIcons[k] = v;
    }
    for (const [k, v] of Object.entries(other.adminPermissionIcons)) {
      this.adminPermissionIcons[k] = v;
    }
    for (const [k, v] of Object.entries(other.serverPermissionIcons)) {
      this.serverPermissionIcons[k] = v;
    }

    return this;
  }

  /** @since 1.0.0 */
  public addUserPermissionIcon(group: string, icon: ReactNode): this {
    this.userPermissionIcons[group] = icon;

    return this;
  }

  /** @since 1.0.0 */
  public addAdminPermissionIcon(group: string, icon: ReactNode): this {
    this.adminPermissionIcons[group] = icon;

    return this;
  }

  /** @since 1.0.0 */
  public addServerPermissionIcon(group: string, icon: ReactNode): this {
    this.serverPermissionIcons[group] = icon;

    return this;
  }
}
