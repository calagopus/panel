import { SelectProps } from '@mantine/core';
import { useState } from 'react';
import { z } from 'zod';
import getTeamPresets from '@/api/me/teams/presets/getTeamPresets.ts';
import Select from '@/elements/input/Select.tsx';
import { canGrantTeamPreset } from '@/lib/domain/teams.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { userTeamPresetSchema, userTeamSchema } from '@/lib/schemas/user/teams.ts';
import { useInfiniteSearchableResource } from '@/plugins/resource/useInfiniteSearchableResource.ts';

type TeamPreset = z.infer<typeof userTeamPresetSchema>;

type Props = Omit<SelectProps, 'data' | 'value' | 'onChange'> & {
  team: z.infer<typeof userTeamSchema>;
  value: string | null;
  onChange: (uuid: string | null, preset: TeamPreset | null) => void;
  includeItems?: TeamPreset[];
  exclude?: string[];
};

export default function TeamPresetSelect({ team, value, onChange, includeItems = [], exclude = [], ...rest }: Props) {
  const [lastSelected, setLastSelected] = useState<TeamPreset | null>(null);

  const presets = useInfiniteSearchableResource<TeamPreset>({
    queryKey: queryKeys.user.teams.presets(team.uuid),
    fetcher: (page, search) => getTeamPresets(team.uuid, page, search),
  });

  const known = new Map<string, TeamPreset>();
  for (const preset of [
    ...includeItems,
    ...presets.items.filter((preset) => canGrantTeamPreset(team, preset)),
    ...(lastSelected ? [lastSelected] : []),
  ]) {
    if (!exclude.includes(preset.uuid)) {
      known.set(preset.uuid, preset);
    }
  }

  const data = [...known.values()].map((preset) => ({ label: preset.name, value: preset.uuid }));

  return (
    <Select
      data={data}
      value={value}
      onChange={(uuid) => {
        const preset = uuid ? (known.get(uuid) ?? null) : null;
        if (preset) {
          setLastSelected(preset);
        }
        onChange(uuid, preset);
      }}
      searchable
      searchValue={presets.search}
      onSearchChange={presets.setSearch}
      infiniteScroll={presets.infiniteScroll}
      loading={presets.loading}
      {...rest}
    />
  );
}
