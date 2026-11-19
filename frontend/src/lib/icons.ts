import type { IconDefinition, IconName, IconPrefix } from '@fortawesome/fontawesome-svg-core';
import { useMemo } from 'react';
import { z } from 'zod';
import type { IconLike } from '@/elements/data-display/Icon.tsx';
import { exemptFromReplacement } from '@/lib/iconReplacements.ts';
import { iconSchema } from '@/lib/schemas/icons.ts';
import { useGlobalStore } from '@/stores/global.ts';

const FONTAWESOME_PREFIXES: Record<string, IconPrefix> = {
  solid: 'fas',
  regular: 'far',
  brands: 'fab',
};

export function toIconDefinition(identifier: string, icon: z.infer<typeof iconSchema>): IconDefinition {
  const [, set = '', name = identifier] = identifier.split(':');

  return exemptFromReplacement({
    prefix: FONTAWESOME_PREFIXES[set] ?? 'fas',
    iconName: name as IconName,
    icon: [icon.width, icon.height, [], '', icon.path],
  });
}

/**
 * Resolves a configured icon identifier against the icons loaded at boot, returning `fallback`
 * when no identifier is set or the icon is unknown.
 */
export function useCustomIcon<T extends IconLike | undefined>(
  identifier: string | null | undefined,
  fallback: T,
): IconDefinition | T {
  const icon = useGlobalStore((state) => (identifier ? state.icons[identifier] : undefined));

  return useMemo(
    () => (identifier && icon ? toIconDefinition(identifier, icon) : fallback),
    [identifier, icon, fallback],
  );
}
