import { Registry } from 'shared';
import type { ThemeScheme, ThemeVariantCategory, ThemeVariantDefinition } from '@/lib/themeVariants.ts';

export class ThemeRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.variants.push(...other.variants);
    for (const [id, category] of Object.entries(other.categories)) {
      this.categories[id] = category;
    }
    if (other.variantsDisabled) {
      this.disableVariants({ schemes: other.allowedSchemes });
    }

    return this;
  }

  /** @since 1.2.11 */
  public variants: ThemeVariantDefinition[] = [];

  /**
   * Lists the variant in the theme picker, an id matching a stock variant overrides it. Ship the styling in your
   * `app.css`, scoped by both attributes: `:root[data-mantine-color-scheme='dark'][data-theme-variant='<id>']`.
   *
   * While the variant is active (selected and the current scheme is in `schemes`), `mantineTheme` is merged over the
   * app theme with `mergeThemeOverrides` (functions, arrays and strings replace the base value rather than merging),
   * `cssVariablesResolver` runs after the app resolvers, and `enter(scope)` runs. Everything registered through the
   * scope (interceptors, base component replacements, `onExit` callbacks) is undone automatically on exit.
   *
   * IF your goal is to make a full panel theme, this system is likely not what you want, see `disableVariants`.
   * @since 1.2.11
   */
  public addVariant(definition: ThemeVariantDefinition): this {
    this.variants.push(definition);
    return this;
  }

  /**
   * Keyed by category id, a later registration with the same id replaces the earlier one.
   * @since 1.2.11
   */
  public categories: Record<string, ThemeVariantCategory> = {};

  /**
   * Groups variants into a submenu of the theme picker: variants and other categories join it by setting `category`
   * to its id, so categories nest and several extensions can share one. Prefix ids with your extension id to avoid
   * collisions. An unknown `category` places the entry at the top level, empty categories are hidden.
   * @since 1.2.11
   */
  public addCategory(category: ThemeVariantCategory): this {
    this.categories[category.id] = category;
    return this;
  }

  /** @since 1.2.11 */
  public variantsDisabled: boolean = false;
  /** @since 1.2.11 */
  public allowedSchemes: ThemeScheme[] = ['light', 'dark'];

  /**
   * For full panel themes: hides every variant (stock and extension ones) so only `standard` is used, and clears a
   * stored selection. `schemes` limits the color schemes your theme supports, with a single one the panel is forced
   * into it and the picker is hidden. Several callers intersect their schemes.
   * @since 1.2.11
   */
  public disableVariants(options: { schemes?: ThemeScheme[] } = {}): this {
    const schemes = options.schemes ?? ['light', 'dark'];
    const intersection = this.allowedSchemes.filter((scheme) => schemes.includes(scheme));

    if (intersection.length === 0) {
      console.warn('disableVariants: no color scheme left after intersecting, keeping', this.allowedSchemes);
    } else {
      this.allowedSchemes = intersection;
    }

    this.variantsDisabled = true;
    return this;
  }
}
