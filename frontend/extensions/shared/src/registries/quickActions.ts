import { Registry } from 'shared';
import type { QuickActionCategory, QuickActionDefinition, QuickActionMode } from '@/lib/quickActions/quickActions.ts';

export class QuickActionRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.definitions.push(...other.definitions);
    this.modes.push(...other.modes);
    for (const [id, category] of Object.entries(other.categories)) {
      this.categories[id] = category;
    }

    return this;
  }

  /** @since 1.2.0 */
  public definitions: QuickActionDefinition[] = [];
  /**
   * Palette modes activated by a query prefix.
   * @since 1.2.0
   */
  public modes: QuickActionMode[] = [];
  /**
   * Keyed by category id, an id matching a stock category overrides it.
   * @since 1.2.0
   */
  public categories: Record<string, QuickActionCategory> = {};

  /** @since 1.2.0 */
  public addAction(definition: QuickActionDefinition): this {
    this.definitions.push(definition);
    return this;
  }

  /** @since 1.2.0 */
  public addMode(mode: QuickActionMode): this {
    this.modes.push(mode);
    return this;
  }

  /** @since 1.2.0 */
  public addCategory(category: QuickActionCategory): this {
    this.categories[category.id] = category;
    return this;
  }
}
