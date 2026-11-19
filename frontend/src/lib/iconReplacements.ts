import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { create } from 'zustand';
import type { IconLike } from '@/elements/data-display/Icon.tsx';

interface IconReplacementStore {
  replacements: Map<string, IconLike>;
}

export const useIconReplacementStore = create<IconReplacementStore>()(() => ({
  replacements: new Map(),
}));

const exemptIcons = new WeakSet<IconDefinition>();
const scopedReplacements: [string, IconLike][] = [];

export function getIconKey(icon: IconDefinition): string {
  return `${icon.prefix}:${icon.iconName}`;
}

// admin-configured icons share prefix/name with stock ones, they must not be swapped by a theme
export function exemptFromReplacement(icon: IconDefinition): IconDefinition {
  exemptIcons.add(icon);
  return icon;
}

function rebuildReplacements() {
  const replacements = new Map(Object.entries(window.extensionContext.extensionRegistry.icons.replacements));
  for (const [key, replacement] of scopedReplacements) {
    replacements.set(key, replacement);
  }

  useIconReplacementStore.setState({ replacements });
}

export function registerIconReplacements() {
  rebuildReplacements();
}

export function addIconReplacement(original: IconDefinition, replacement: IconLike): () => void {
  const entry: [string, IconLike] = [getIconKey(original), replacement];
  scopedReplacements.push(entry);
  rebuildReplacements();

  return () => {
    const index = scopedReplacements.indexOf(entry);
    if (index === -1) return;

    scopedReplacements.splice(index, 1);
    rebuildReplacements();
  };
}

export function useIconReplacement(icon: IconDefinition | undefined): IconLike | undefined {
  return useIconReplacementStore((state) =>
    icon && !exemptIcons.has(icon) ? state.replacements.get(getIconKey(icon)) : undefined,
  );
}
