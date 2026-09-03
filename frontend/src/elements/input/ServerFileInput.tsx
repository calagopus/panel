import { faFile, faFolder } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { AutocompleteProps } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { makeComponentHookable } from 'shared';
import loadDirectory from '@/api/server/files/loadDirectory.ts';
import Spinner from '@/elements/feedback/Spinner.tsx';
import Autocomplete from '@/elements/input/Autocomplete.tsx';
import Group from '@/elements/layout/Group.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';

const MAX_SUGGESTIONS = 50;

type Props = Omit<AutocompleteProps, 'value' | 'onChange' | 'data' | 'filter' | 'renderOption'> & {
  serverUuid: string;
  value: string;
  onChange: (value: string) => void;
  mode?: 'file' | 'directory';
};

function splitPath(value: string): { directory: string; prefix: string } {
  const trimmed = value.replace(/^\/+/, '');
  const slash = trimmed.lastIndexOf('/');

  return slash === -1
    ? { directory: '', prefix: trimmed }
    : { directory: trimmed.slice(0, slash), prefix: trimmed.slice(slash + 1) };
}

function ServerFileInput({ serverUuid, value, onChange, mode = 'file', ...rest }: Props) {
  const canRead = useServerCan('files.read');
  const [opened, setOpened] = useState(false);

  const { directory, prefix } = splitPath(value);

  const { data, isFetching } = useQuery({
    queryKey: queryKeys.server(serverUuid).files.pathSuggestions(directory),
    queryFn: () => loadDirectory(serverUuid, `/${directory}`, 1, 'name_asc'),
    enabled: canRead && opened,
    staleTime: 30_000,
    retry: false,
  });

  const options = useMemo(() => {
    const lowerPrefix = prefix.toLowerCase();

    return (data?.entries.data ?? [])
      .filter((entry) => mode === 'file' || entry.directory)
      .filter((entry) => entry.name.toLowerCase().startsWith(lowerPrefix))
      .toSorted((a, b) => Number(b.directory) - Number(a.directory) || a.name.localeCompare(b.name))
      .slice(0, MAX_SUGGESTIONS)
      .map((entry) => {
        const path = `${directory ? `${directory}/` : ''}${entry.name}${entry.directory ? '/' : ''}`;

        return { value: path, label: path, directory: entry.directory };
      });
  }, [data, directory, prefix, mode]);

  return (
    <Autocomplete
      {...rest}
      value={value}
      onChange={onChange}
      data={options}
      filter={({ options }) => options}
      limit={MAX_SUGGESTIONS}
      dropdownOpened={opened && options.length > 0}
      onDropdownOpen={() => setOpened(true)}
      onDropdownClose={() => setOpened(false)}
      onOptionSubmit={(selected) => {
        if (selected.endsWith('/')) {
          setTimeout(() => setOpened(true), 0);
        }
      }}
      rightSection={isFetching ? <Spinner size={14} /> : undefined}
      renderOption={({ option }) => {
        const entry = options.find((candidate) => candidate.value === option.value);

        return (
          <Group gap='xs' wrap='nowrap'>
            <FontAwesomeIcon
              icon={entry?.directory ? faFolder : faFile}
              className='text-(--mantine-color-dimmed) shrink-0'
            />
            <span className='truncate'>{option.value}</span>
          </Group>
        );
      }}
    />
  );
}

export default makeComponentHookable(ServerFileInput);
