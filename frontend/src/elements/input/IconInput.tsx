import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faMagnifyingGlass, faRotateLeft } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Input, SimpleGrid } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useQuery } from '@tanstack/react-query';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { makeComponentHookable } from 'shared';
import { iconManifestUrl } from 'virtual:icon-manifest';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import Button from '@/elements/buttons/Button.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import Popover from '@/elements/overlays/Popover.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import Text from '@/elements/typography/Text.tsx';
import { toIconDefinition, useCustomIcon } from '@/lib/icons.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';

const MAX_RESULTS = 96;

type IconManifest = Record<string, [width: number, height: number, path: string, aliases: string[]]>;

interface IconInputProps {
  label?: string;
  description?: string;
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  fallback?: IconDefinition;
  size?: 'xs' | 'sm' | 'md';
  disabled?: boolean;
  error?: ReactNode;
}

function IconInput({ label, description, value, onChange, fallback, size = 'sm', disabled, error }: IconInputProps) {
  const { t } = useTranslations();
  const addIcons = useGlobalStore((state) => state.addIcons);

  const [selected, setSelected] = useState(value ?? null);
  const [opened, setOpened] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 150);

  useEffect(() => {
    setSelected(value ?? null);
  }, [value]);

  const isLoaded = useGlobalStore((state) => !selected || !!state.icons[selected]);

  const { data: manifest, isLoading } = useQuery({
    queryKey: queryKeys.global.iconManifest.all(),
    queryFn: () => fetch(iconManifestUrl).then((response) => response.json() as Promise<IconManifest>),
    staleTime: Infinity,
    enabled: opened || !isLoaded,
  });

  const results = useMemo(() => {
    if (!manifest) return [];

    const terms = debouncedSearch.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const matches: string[] = [];

    for (const [identifier, [, , , aliases]] of Object.entries(manifest)) {
      if (terms.every((term) => identifier.includes(term) || aliases.some((alias) => alias.includes(term)))) {
        matches.push(identifier);
        if (matches.length > MAX_RESULTS) break;
      }
    }

    return matches;
  }, [manifest, debouncedSearch]);

  const customIcon = useCustomIcon(selected, fallback);
  const manifestIcon = !isLoaded && selected ? manifest?.[selected] : undefined;
  const current =
    selected && manifestIcon
      ? toIconDefinition(selected, { width: manifestIcon[0], height: manifestIcon[1], path: manifestIcon[2] })
      : customIcon;

  const select = (identifier: string | null) => {
    if (identifier && manifest?.[identifier]) {
      const [width, height, path] = manifest[identifier];
      addIcons({ [identifier]: { width, height, path } });
    }

    setSelected(identifier);
    onChange(identifier);
    setOpened(false);
  };

  return (
    <Input.Wrapper label={label} description={description} error={error} size={size}>
      <div>
        <Popover opened={opened} onChange={setOpened} width={360} position='bottom-start' shadow='md' withinPortal>
          <Popover.Target>
            <Tooltip label={selected ?? t('common.elements.iconInput.defaultIcon', {})} withArrow disabled={opened}>
              <ActionIcon
                variant='default'
                size={`input-${size}`}
                disabled={disabled}
                onClick={() => setOpened((o) => !o)}
                style={{ flexShrink: 0 }}
              >
                {current && <FontAwesomeIcon icon={current} style={{ opacity: selected ? 1 : 0.6 }} />}
              </ActionIcon>
            </Tooltip>
          </Popover.Target>
          <Popover.Dropdown>
            <Stack gap='xs'>
              <TextInput
                size='xs'
                leftSection={<FontAwesomeIcon icon={faMagnifyingGlass} />}
                placeholder={t('common.elements.iconInput.searchPlaceholder', {})}
                value={search}
                onChange={(e) => setSearch(e.currentTarget.value)}
                data-autofocus
              />

              {isLoading || !manifest ? (
                <Spinner.Centered />
              ) : results.length === 0 ? (
                <Text size='sm' c='dimmed' ta='center' py='sm'>
                  {t('common.elements.iconInput.noResults', {})}
                </Text>
              ) : (
                <SimpleGrid cols={8} spacing={4} verticalSpacing={4} className='max-h-64 overflow-y-auto'>
                  {results.slice(0, MAX_RESULTS).map((identifier) => {
                    const [width, height, path] = manifest[identifier];

                    return (
                      <ActionIcon
                        key={identifier}
                        variant={identifier === selected ? 'filled' : 'subtle'}
                        color={identifier === selected ? 'blue' : 'gray'}
                        title={identifier}
                        onClick={() => select(identifier)}
                      >
                        <FontAwesomeIcon icon={toIconDefinition(identifier, { width, height, path })} />
                      </ActionIcon>
                    );
                  })}
                </SimpleGrid>
              )}

              {results.length > MAX_RESULTS && (
                <Text size='xs' c='dimmed'>
                  {t('common.elements.iconInput.moreResults', { count: MAX_RESULTS })}
                </Text>
              )}

              <Group justify='flex-end'>
                <Button
                  size='xs'
                  variant='subtle'
                  leftSection={<FontAwesomeIcon icon={faRotateLeft} />}
                  disabled={!selected}
                  onClick={() => select(null)}
                >
                  {t('common.elements.iconInput.button.reset', {})}
                </Button>
              </Group>
            </Stack>
          </Popover.Dropdown>
        </Popover>
      </div>
    </Input.Wrapper>
  );
}

export default makeComponentHookable(IconInput);
