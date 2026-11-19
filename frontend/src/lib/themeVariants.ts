import type { HookableComponentBase } from 'shared';
import { faCircle, faPalette, type IconDefinition } from '@fortawesome/free-solid-svg-icons';
import { type CSSVariablesResolver, type MantineThemeOverride } from '@mantine/core';
import type { LazyString } from '@/lib/lazy.ts';
import { getTranslations } from '@/providers/TranslationProvider.tsx';

export type ThemeScheme = 'light' | 'dark';

export class ThemeVariantScope {
  private disposers: (() => void)[] = [];

  public addPropsInterceptor<P>(component: HookableComponentBase<P>, interceptor: (props: P) => P): this {
    this.disposers.push(component.addPropsInterceptor(interceptor));
    return this;
  }

  public addRenderInterceptor<P>(
    component: HookableComponentBase<P>,
    interceptor: (element: React.ReactElement<P>, props: P) => React.ReactElement<P>,
  ): this {
    this.disposers.push(component.addRenderInterceptor(interceptor));
    return this;
  }

  public replaceBaseComponent<P>(component: HookableComponentBase<P>, replacement: React.ComponentType<P>): this {
    this.disposers.push(component.replaceBaseComponent(replacement));
    return this;
  }

  public onExit(cleanup: () => void): this {
    this.disposers.push(cleanup);
    return this;
  }

  public dispose() {
    for (const dispose of this.disposers.splice(0).reverse()) {
      try {
        dispose();
      } catch (err) {
        console.error('Error while exiting theme variant', err);
      }
    }
  }
}

export interface ThemeVariantDefinition {
  id: string;
  label: LazyString;
  icon?: IconDefinition;
  schemes: ThemeScheme[];
  mantineTheme?: MantineThemeOverride;
  cssVariablesResolver?: CSSVariablesResolver;
  enter?: (scope: ThemeVariantScope) => void;
}

export const DEFAULT_THEME_VARIANT = 'standard';

const BUILTIN_THEME_VARIANTS: ThemeVariantDefinition[] = [
  {
    id: DEFAULT_THEME_VARIANT,
    label: () => getTranslations().t('elements.sidebar.button.themeStandard', {}),
    icon: faPalette,
    schemes: ['light', 'dark'],
  },
  {
    id: 'pure-black',
    label: () => getTranslations().t('elements.sidebar.button.themePureBlack', {}),
    icon: faCircle,
    schemes: ['dark'],
  },
];

export function getThemeVariants(): ThemeVariantDefinition[] {
  const registry = window.extensionContext.extensionRegistry.themes;
  if (registry.variantsDisabled) {
    return [{ ...BUILTIN_THEME_VARIANTS[0], schemes: registry.allowedSchemes }];
  }

  const variants = new Map(BUILTIN_THEME_VARIANTS.map((variant) => [variant.id, variant]));

  for (const variant of registry.variants) {
    if (variant.schemes.length > 0) {
      variants.set(variant.id, variant);
    }
  }

  return [...variants.values()];
}

export function getThemeVariant(id: string): ThemeVariantDefinition | undefined {
  return getThemeVariants().find((variant) => variant.id === id);
}

export function getForcedColorScheme(): ThemeScheme | undefined {
  const { allowedSchemes } = window.extensionContext.extensionRegistry.themes;

  return allowedSchemes.length === 1 ? allowedSchemes[0] : undefined;
}

export function combineCssVariablesResolvers(
  resolvers: (CSSVariablesResolver | null | undefined)[],
): CSSVariablesResolver | undefined {
  const active = resolvers.filter((resolver): resolver is CSSVariablesResolver => Boolean(resolver));
  if (active.length <= 1) return active[0];

  return (theme) => {
    const combined = { variables: {}, light: {}, dark: {} };

    for (const resolver of active) {
      const result = resolver(theme);
      Object.assign(combined.variables, result.variables);
      Object.assign(combined.light, result.light);
      Object.assign(combined.dark, result.dark);
    }

    return combined;
  };
}
