import type { CSSVariablesResolver, MantineThemeOverride } from '@mantine/core';
import { mergeThemeOverrides } from '@mantine/core';
import { merge } from 'object-deep-merge';
import { shadcnCssVariablesResolver } from './cssVariablesResolver.ts';
import { shadcnMinimalTheme } from './minimalTheme.ts';
import { shadcnTheme } from './theme.ts';

export const SHADCN_THEME_STORAGE_KEY = 'shadcn_theme';
export const SHADCN_THEME_MINIMAL_STORAGE_KEY = 'shadcn_theme_minimal';

export function isShadcnThemeEnabled(): boolean {
  return localStorage.getItem(SHADCN_THEME_STORAGE_KEY) === 'true';
}

export function isShadcnMinimalThemeEnabled(): boolean {
  return localStorage.getItem(SHADCN_THEME_MINIMAL_STORAGE_KEY) === 'true';
}

interface AppliedTheme {
  theme: MantineThemeOverride;
  cssVariablesResolver: CSSVariablesResolver;
}

function applyTheme(
  baseTheme: MantineThemeOverride,
  theme: MantineThemeOverride,
  cssVariablesResolver: CSSVariablesResolver | null,
): AppliedTheme {
  document.documentElement.setAttribute('data-shadcn-theme', '');

  return {
    theme: mergeThemeOverrides(baseTheme, theme),
    cssVariablesResolver: cssVariablesResolver
      ? (mantineTheme) => merge(shadcnCssVariablesResolver(mantineTheme), cssVariablesResolver(mantineTheme))
      : shadcnCssVariablesResolver,
  };
}

export function applyShadcnTheme(
  theme: MantineThemeOverride,
  cssVariablesResolver: CSSVariablesResolver | null,
): AppliedTheme {
  import('./style.css');

  return applyTheme(shadcnTheme, theme, cssVariablesResolver);
}

export function applyShadcnMinimalTheme(
  theme: MantineThemeOverride,
  cssVariablesResolver: CSSVariablesResolver | null,
): AppliedTheme {
  return applyTheme(shadcnMinimalTheme, theme, cssVariablesResolver);
}

export { shadcnCssVariablesResolver, shadcnMinimalTheme, shadcnTheme };
