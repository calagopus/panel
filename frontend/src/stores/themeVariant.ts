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

interface ThemeVariantStore {
  variant: string;
  // the selected variant while it supports the current scheme, standard otherwise
  activeVariant: string;
}

export const useThemeVariantStore = create<ThemeVariantStore>()(() => ({
  variant: safeLocalStorageGet(storageKey) || DEFAULT_THEME_VARIANT,
  activeVariant: DEFAULT_THEME_VARIANT,
}));

export function setThemeVariant(variant: string) {
  if (variant === DEFAULT_THEME_VARIANT) {
    safeLocalStorageRemove(storageKey);
  } else {
    safeLocalStorageSet(storageKey, variant);
  }

  useThemeVariantStore.setState({ variant });
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
  }

  if (!getThemeVariant(useThemeVariantStore.getState().variant)) {
    setThemeVariant(DEFAULT_THEME_VARIANT);
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
    }
  });
}
