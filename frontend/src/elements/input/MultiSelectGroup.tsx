import { Badge, Checkbox, type ComboboxItem, Group, MultiSelect, type MultiSelectProps, Text } from '@mantine/core';
import { useMemo, useState } from 'react';

type GroupedData = {
  group: string;
  items: ComboboxItem[];
};

type SelectItem = ComboboxItem & { isSelectAll?: boolean };

const SELECT_ALL_PREFIX = '__group_all__';

const toSelectAll = (group: string) => `${SELECT_ALL_PREFIX}${group}`;
const isSelectAll = (v: string) => v.startsWith(SELECT_ALL_PREFIX);
const getGroup = (v: string) => v.replace(SELECT_ALL_PREFIX, '');

interface Props extends Omit<MultiSelectProps, 'data' | 'value' | 'onChange'> {
  data: GroupedData[];
  value?: string[];
  defaultValue?: string[];
  onChange?: (value: string[]) => void;
}

export default function MultiSelectGroup({ data, value, defaultValue = [], onChange, ...rest }: Props) {
  const [internal, setInternal] = useState(defaultValue);
  const controlled = value !== undefined;
  const current = controlled ? value! : internal;

  const groupMap = useMemo(
    () => Object.fromEntries(data.map(({ group, items }) => [group, items.map((i) => i.value)])),
    [data],
  );

  const options = useMemo(
    () =>
      data.map(({ group, items }) => ({
        group,
        items: [
          {
            value: toSelectAll(group),
            label: `Select all of ${group}`,
            isSelectAll: true,
          },
          ...items,
        ] as SelectItem[],
      })),
    [data],
  );

  const update = (next: string[]) => {
    if (!controlled) setInternal(next);
    onChange?.(next);
  };

  const handleChange: MultiSelectProps['onChange'] = (vals) => {
    let next = vals.filter((v) => !isSelectAll(v));

    vals.filter(isSelectAll).forEach((sentinel) => {
      const group = getGroup(sentinel);
      const items = groupMap[group] ?? [];

      const allSelected = items.every((i) => next.includes(i));

      next = allSelected
        ? next.filter((v) => !items.includes(v)) // unselect all
        : [...new Set([...next, ...items])]; // select all
    });

    update(next);
  };

  const renderOption: MultiSelectProps['renderOption'] = ({ option, checked }) => {
    const item = option as SelectItem;

    if (item.isSelectAll) {
      const group = getGroup(item.value);
      const items = groupMap[group] ?? [];

      const selected = items.filter((v) => current.includes(v)).length;
      const all = selected === items.length;
      const some = selected > 0 && !all;

      return (
        <Group w='100%'>
          <Checkbox checked={all} indeterminate={some} size='xs' />
          <Text size='sm' fw={600}>
            {item.label}
          </Text>
          <Badge ml='auto' size='xs' variant='light'>
            {selected}/{items.length}
          </Badge>
        </Group>
      );
    }

    return (
      <Group>
        <Checkbox checked={checked} size='xs' />
        <Text size='sm'>{item.label}</Text>
      </Group>
    );
  };

  return <MultiSelect {...rest} data={options} value={current} onChange={handleChange} renderOption={renderOption} />;
}
