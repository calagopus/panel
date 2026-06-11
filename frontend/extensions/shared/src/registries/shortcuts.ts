import { Registry } from 'shared';
import type { ShortcutCategory, ShortcutDefinition } from '@/lib/shortcuts.ts';

export class ShortcutRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.definitions.push(...other.definitions);
    for (const [id, category] of Object.entries(other.categories)) {
      this.categories[id] = category;
    }

    return this;
  }

  public definitions: ShortcutDefinition[] = [];
  public categories: Record<string, ShortcutCategory> = {};

  public addShortcut(definition: ShortcutDefinition): this {
    this.definitions.push(definition);
    return this;
  }

  public addCategory(category: ShortcutCategory): this {
    this.categories[category.id] = category;
    return this;
  }
}
