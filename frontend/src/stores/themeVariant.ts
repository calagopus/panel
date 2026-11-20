import { create } from 'zustand';
import { safeLocalStorageGet, safeLocalStorageRemove, safeLocalStorageSet } from '@/lib/safeStorage.ts';
import {
  DEFAULT_THEME_VARIANT,
  getForcedColorScheme,
  getThemeVariant,
  type ThemeScheme,
  ThemeVariantScope,
} from '@/lib/themeVariants.ts';

const storageKey = 'theme_variant';
const autoSchemeStorageKey = 'theme_auto_scheme';

interface ThemeVariantStore {
  variant: string;
  // the selected variant while it supports the current scheme, standard otherwise
  activeVariant: string;
  // auto was picked while the selected variant only has one scheme
  autoScheme: boolean;
}

export const useThemeVariantStore = create<ThemeVariantStore>()(() => ({
  variant: safeLocalStorageGet(storageKey) || DEFAULT_THEME_VARIANT,
  activeVariant: DEFAULT_THEME_VARIANT,
  autoScheme: safeLocalStorageGet(autoSchemeStorageKey) === '1',
}));

export function setThemeVariant(variant: string) {
  if (variant === DEFAULT_THEME_VARIANT) {
    safeLocalStorageRemove(storageKey);
  } else {
    safeLocalStorageSet(storageKey, variant);
  }

  useThemeVariantStore.setState({ variant });
}

export function setAutoScheme(autoScheme: boolean) {
  if (autoScheme) {
    safeLocalStorageSet(autoSchemeStorageKey, '1');
  } else {
    safeLocalStorageRemove(autoSchemeStorageKey);
  }

  useThemeVariantStore.setState({ autoScheme });
}

function currentScheme(): ThemeScheme {
  return document.documentElement.dataset.mantineColorScheme === 'light' ? 'light' : 'dark';
}

function resolveActiveVariant(variant: string): string {
  return getThemeVariant(variant)?.schemes.includes(currentScheme()) ? variant : DEFAULT_THEME_VARIANT;
}

let activeScope: ThemeVariantScope | null = null;

function enterVariant(id: string) {
  activeScope?.dispose();
  activeScope = new ThemeVariantScope();

  try {
    getThemeVariant(id)?.enter?.(activeScope);
  } catch (err) {
    console.error('Error while entering theme variant', id, err);
    activeScope.dispose();
  }
}

export function registerThemeVariant() {
  const forcedScheme = getForcedColorScheme();
  if (forcedScheme) {
    // forceColorScheme handles the session, the stored value only keeps themeBoot.js painting the right scheme
    safeLocalStorageSet('mantine-color-scheme-value', forcedScheme);
    document.documentElement.setAttribute('data-mantine-color-scheme', forcedScheme);
    setAutoScheme(false);
  }

  if (!getThemeVariant(useThemeVariantStore.getState().variant)) {
    setThemeVariant(DEFAULT_THEME_VARIANT);
  }

  const { variant, autoScheme } = useThemeVariantStore.getState();
  if (autoScheme && getThemeVariant(variant)!.schemes.length > 1) {
    // runs before MantineProvider mounts, which reads the stored value initially
    safeLocalStorageSet('mantine-color-scheme-value', 'auto');
    setAutoScheme(false);
  }

  const syncActiveVariant = () => {
    const { variant, activeVariant } = useThemeVariantStore.getState();
    const nextActive = resolveActiveVariant(variant);

    document.documentElement.dataset.themeVariant = getThemeVariant(variant) ? variant : DEFAULT_THEME_VARIANT;
    if (nextActive !== activeVariant || !activeScope) {
      enterVariant(nextActive);
      useThemeVariantStore.setState({ activeVariant: nextActive });
    }
  };

  syncActiveVariant();
  useThemeVariantStore.subscribe((state, previous) => {
    if (state.variant !== previous.variant) syncActiveVariant();
  });
  new MutationObserver(syncActiveVariant).observe(document.documentElement, {
    attributeFilter: ['data-mantine-color-scheme'],
  });

  window.addEventListener('storage', (event) => {
    if (event.key === storageKey) {
      const variant = event.newValue || DEFAULT_THEME_VARIANT;
      useThemeVariantStore.setState({ variant: getThemeVariant(variant) ? variant : DEFAULT_THEME_VARIANT });
    } else if (event.key === autoSchemeStorageKey) {
      useThemeVariantStore.setState({ autoScheme: event.newValue === '1' });
    }
  });
}
