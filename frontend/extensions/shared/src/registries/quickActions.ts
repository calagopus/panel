import { Registry } from 'shared';
import type { QuickActionCategory, QuickActionDefinition, QuickActionMode } from '@/lib/quickActions.ts';

export class QuickActionRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.definitions.push(...other.definitions);
    this.modes.push(...other.modes);
    for (const [id, category] of Object.entries(other.categories)) {
      this.categories[id] = category;
    }

    return this;
  }

  public definitions: QuickActionDefinition[] = [];
  public modes: QuickActionMode[] = [];
  public categories: Record<string, QuickActionCategory> = {};

  public addAction(definition: QuickActionDefinition): this {
    this.definitions.push(definition);
    return this;
  }

  public addMode(mode: QuickActionMode): this {
    this.modes.push(mode);
    return this;
  }

  public addCategory(category: QuickActionCategory): this {
    this.categories[category.id] = category;
    return this;
  }
}
