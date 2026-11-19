import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { Registry } from 'shared';
import type { IconLike } from '@/elements/data-display/Icon.tsx';

export class IconRegistry implements Registry {
  /**
   * Keyed by `<prefix>:<iconName>` of the replaced icon.
   * @since 1.2.11
   */
  public replacements: Record<string, IconLike> = {};

  public mergeFrom(other: this): this {
    for (const [k, v] of Object.entries(other.replacements)) {
      this.replacements[k] = v;
    }

    return this;
  }

  /**
   * Renders `replacement` everywhere the panel renders `original`, later extensions win. Admin-configured icons are
   * never replaced. To replace icons only while a theme variant is active, use `ThemeVariantScope.replaceIcon`.
   * @since 1.2.11
   */
  public replaceIcon(original: IconDefinition, replacement: IconLike): this {
    const key: string = `${original.prefix}:${original.iconName}`;
    this.replacements[key] = replacement;

    return this;
  }
}
