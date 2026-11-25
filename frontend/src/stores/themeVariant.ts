import { create } from 'zustand';
import { safeLocalStorageGet, safeLocalStorageRemove, safeLocalStorageSet } from '@/lib/safeStorage.ts';
import {
  DEFAULT_THEME_VARIANT,
  getForcedColorScheme,
  getThemeVariant,
  loadThemeVariantStylesheets,
  type ThemeScheme,
  ThemeVariantScope,
} from '@/lib/themeVariants.ts';
import { scheduleAssetReload } from '@/stores/assetReload.ts';

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
let targetVariant: string | null = null;
let enterGeneration = 0;
let appliedGeneration = 0;

function selectedVariantAttribute(): string {
  const { variant } = useThemeVariantStore.getState();

  return getThemeVariant(variant) ? variant : DEFAULT_THEME_VARIANT;
}

// the previous variant stays applied, until the next ones stylesheets have loaded
async function enterVariant(id: string) {
  const generation = ++enterGeneration;
  targetVariant = id;

  let sheets: CSSStyleSheet[];
  try {
    sheets = await loadThemeVariantStylesheets(getThemeVariant(id));
  } catch (err) {
    if (generation !== enterGeneration) return;

    console.error('Failed to load theme variant stylesheets', id, err);
    scheduleAssetReload();
    // session-only fallback, the stored selection is retried on the next load
    useThemeVariantStore.setState({ variant: DEFAULT_THEME_VARIANT });
    return;
  }

  if (generation !== enterGeneration) return;
  appliedGeneration = generation;

  activeScope?.dispose();
  const scope = new ThemeVariantScope();
  activeScope = scope;

  document.documentElement.dataset.themeVariant = selectedVariantAttribute();
  useThemeVariantStore.setState({ activeVariant: id });

  if (sheets.length > 0) {
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, ...sheets];
    scope.onExit(() => {
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter((sheet) => !sheets.includes(sheet));
    });
  }

  try {
    getThemeVariant(id)?.enter?.(scope);
  } catch (err) {
    console.error('Error while entering theme variant', id, err);
    scope.dispose();
  }
}

export function registerThemeVariant(): Promise<void> {
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

  const syncActiveVariant = async () => {
    const nextActive = resolveActiveVariant(useThemeVariantStore.getState().variant);

    if (nextActive !== targetVariant) {
      await enterVariant(nextActive);
    } else if (appliedGeneration === enterGeneration) {
      document.documentElement.dataset.themeVariant = selectedVariantAttribute();
    }
  };

  const initialVariant = syncActiveVariant();
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

  return initialVariant;
}
