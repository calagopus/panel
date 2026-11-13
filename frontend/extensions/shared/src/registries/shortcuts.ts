import { Registry } from 'shared';
import type { ShortcutCategory, ShortcutDefinition } from '@/lib/quickActions/shortcuts.ts';

export class ShortcutRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.definitions.push(...other.definitions);
    for (const [id, category] of Object.entries(other.categories)) {
      this.categories[id] = category;
    }

    return this;
  }

  /** @since 1.0.10 */
  public definitions: ShortcutDefinition[] = [];
  /**
   * Keyed by category id, an id matching a stock category overrides it.
   * @since 1.0.10
   */
  public categories: Record<string, ShortcutCategory> = {};

  /**
   * Lists the shortcut as rebindable, the extension still listens through `useShortcut` with its id.
   * @since 1.0.10
   */
  public addShortcut(definition: ShortcutDefinition): this {
    this.definitions.push(definition);
    return this;
  }

  /** @since 1.0.10 */
  public addCategory(category: ShortcutCategory): this {
    this.categories[category.id] = category;
    return this;
  }
}
