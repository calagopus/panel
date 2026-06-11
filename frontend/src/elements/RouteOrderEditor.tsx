import { faArrowUpRightFromSquare, faGripVertical, faMinus, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Box, Group, Paper, Stack, Text, useComputedColorScheme } from '@mantine/core';
import { ComponentProps, useCallback, useMemo, useRef, useState } from 'react';
import { RouteDefinition } from 'shared';
import { z } from 'zod';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Badge from '@/elements/Badge.tsx';
import Button from '@/elements/Button.tsx';
import Divider from '@/elements/Divider.tsx';
import { DndContainer, DndItem, SortableItem } from '@/elements/DragAndDrop.tsx';
import LocalizedTextInput from '@/elements/input/LocalizedTextInput.tsx';
import Select from '@/elements/input/Select.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import { eggConfigurationRouteItemSchema } from '@/lib/schemas/generic.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type RouteItem = z.infer<typeof eggConfigurationRouteItemSchema>;

interface DndRouteEntry extends DndItem {
  id: string;
  index: number;
  item: RouteItem;
}

interface RouteOrderEditorProps {
  value: RouteItem[];
  onChange: (value: RouteItem[]) => void;
  routes: RouteDefinition[];
  languages: string[];
  readOnly?: boolean;
}

function itemContentKey(item: RouteItem, index: number): string {
  switch (item.type) {
    case 'route':
      return `route:${item.path}`;
    case 'divider':
      return `divider:${index}`;
    case 'redirect':
      return `redirect:${index}`;
  }
}

export default function RouteOrderEditor({
  value,
  onChange,
  routes,
  languages,
  readOnly = false,
}: RouteOrderEditorProps) {
  const { t } = useTranslations();
  const isDark = useComputedColorScheme('dark') === 'dark';

  const [addType, setAddType] = useState<'route' | 'divider' | 'redirect'>('route');

  const counterRef = useRef(0);
  const idRegistryRef = useRef<Map<string, string>>(new Map());

  const dndItems: DndRouteEntry[] = useMemo(() => {
    const newRegistry = new Map<string, string>();
    const result: DndRouteEntry[] = [];

    for (let i = 0; i < value.length; i++) {
      const item = value[i];
      const contentKey = itemContentKey(item, i);

      let id = idRegistryRef.current.get(contentKey);
      if (!id) {
        id = `dnd-${counterRef.current++}`;
      }
      newRegistry.set(contentKey, id);
      result.push({ id, index: i, item });
    }

    idRegistryRef.current = newRegistry;
    return result;
  }, [value]);

  const usedPaths = useMemo(() => new Set(value.filter((i) => i.type === 'route').map((i) => i.path)), [value]);

  const availableRoutes = useMemo(
    () => routes.filter((r) => r.name !== undefined && !usedPaths.has(r.path)),
    [routes, usedPaths],
  );

  const emit = useCallback(
    (next: RouteItem[]) => {
      onChange(next);
    },
    [onChange],
  );

  const handleRemove = (index: number) => {
    const next = [...value];
    next.splice(index, 1);
    emit(next);
  };

  const handleUpdate = (index: number, updated: RouteItem) => {
    const next = [...value];
    next[index] = updated;
    emit(next);
  };

  const handleAddRoute = (path: string) => {
    emit([...value, { type: 'route', path }]);
  };

  const handleAddDivider = () => {
    emit([...value, { type: 'divider', name: null, nameTranslations: {} }]);
  };

  const handleAddRedirect = () => {
    emit([...value, { type: 'redirect', name: '', nameTranslations: {}, destination: '' }]);
  };

  const getRouteInfo = (path: string) => routes.find((r) => r.path === path);

  const handleDragEnd = (items: DndRouteEntry[]) => {
    emit(items.map((i) => i.item));
  };

  const renderItem = (entry: DndRouteEntry, dragHandleProps?: ComponentProps<'button'>) => {
    const { item, index } = entry;

    if (item.type === 'route') {
      const info = getRouteInfo(item.path);
      const name = info ? (typeof info.name === 'string' ? info.name : info.name!()) : item.path;

      return (
        <Paper withBorder p='xs' radius='sm'>
          <Group gap='xs' wrap='nowrap'>
            {!readOnly && (
              <ActionIcon
                size='sm'
                variant='subtle'
                color='gray'
                style={{ cursor: 'grab', flexShrink: 0 }}
                {...dragHandleProps}
              >
                <FontAwesomeIcon icon={faGripVertical} style={{ fontSize: 14 }} />
              </ActionIcon>
            )}

            <Badge variant={isDark ? 'light' : 'filled'} color='blue' size='sm' style={{ flexShrink: 0 }}>
              {t('elements.routeOrderEditor.label.route', {})}
            </Badge>

            {info?.icon && <FontAwesomeIcon icon={info.icon} style={{ fontSize: 14, opacity: 0.7, flexShrink: 0 }} />}
            <Text size='sm' fw={500} truncate style={{ flex: 1 }}>
              {name}
            </Text>
            <Text size='xs' c='dimmed' truncate style={{ flexShrink: 0 }}>
              {item.path}
            </Text>

            {!readOnly && (
              <Tooltip label={t('common.tooltip.remove', {})} withArrow>
                <ActionIcon
                  variant='subtle'
                  color='red'
                  size='sm'
                  onClick={() => handleRemove(index)}
                  style={{ flexShrink: 0 }}
                >
                  <FontAwesomeIcon icon={faTrash} style={{ fontSize: 12 }} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
        </Paper>
      );
    }

    if (item.type === 'divider') {
      return (
        <Paper withBorder p='xs' radius='sm'>
          <Group gap='xs' wrap='nowrap' align='center'>
            {!readOnly && (
              <ActionIcon
                size='sm'
                variant='subtle'
                color='gray'
                style={{ cursor: 'grab', flexShrink: 0 }}
                {...dragHandleProps}
              >
                <FontAwesomeIcon icon={faGripVertical} style={{ fontSize: 14 }} />
              </ActionIcon>
            )}

            <Badge variant={isDark ? 'light' : 'filled'} color='gray' size='sm' style={{ flexShrink: 0 }}>
              <Group gap={4}>
                <FontAwesomeIcon icon={faMinus} style={{ fontSize: 10 }} />
                {t('elements.routeOrderEditor.label.divider', {})}
              </Group>
            </Badge>

            {readOnly ? (
              <Text size='sm' c='dimmed' style={{ flex: 1 }}>
                {item.name || t('elements.routeOrderEditor.unnamed', {})}
              </Text>
            ) : (
              <Box style={{ flex: 1 }}>
                <LocalizedTextInput
                  languages={languages}
                  value={item.name}
                  setValue={(v) => handleUpdate(index, { ...item, name: v })}
                  valueTranslations={item.nameTranslations}
                  setValueTranslations={(t) => handleUpdate(index, { ...item, nameTranslations: t })}
                  placeholder={t('elements.routeOrderEditor.dividerPlaceholder', {})}
                  size='sm'
                />
              </Box>
            )}

            {!readOnly && (
              <Tooltip label={t('common.tooltip.remove', {})} withArrow>
                <ActionIcon
                  variant='subtle'
                  color='red'
                  size='sm'
                  onClick={() => handleRemove(index)}
                  style={{ flexShrink: 0 }}
                >
                  <FontAwesomeIcon icon={faTrash} style={{ fontSize: 12 }} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
        </Paper>
      );
    }

    if (item.type === 'redirect') {
      return (
        <Paper withBorder p='xs' radius='sm'>
          <Stack gap='xs'>
            <Group gap='xs' wrap='nowrap' align='center'>
              {!readOnly && (
                <ActionIcon
                  size='sm'
                  variant='subtle'
                  color='gray'
                  style={{ cursor: 'grab', flexShrink: 0 }}
                  {...dragHandleProps}
                >
                  <FontAwesomeIcon icon={faGripVertical} style={{ fontSize: 14 }} />
                </ActionIcon>
              )}

              <Badge variant={isDark ? 'light' : 'filled'} color='orange' size='sm' style={{ flexShrink: 0 }}>
                <Group gap={4}>
                  <FontAwesomeIcon icon={faArrowUpRightFromSquare} style={{ fontSize: 10 }} />
                  {t('elements.routeOrderEditor.label.redirect', {})}
                </Group>
              </Badge>

              {readOnly ? (
                <Text size='sm' fw={500} style={{ flex: 1 }}>
                  {item.name || t('elements.routeOrderEditor.unnamed', {})}
                </Text>
              ) : (
                <Box style={{ flex: 1 }}>
                  <LocalizedTextInput
                    languages={languages}
                    value={item.name}
                    setValue={(v) => handleUpdate(index, { ...item, name: v ?? '' })}
                    valueTranslations={item.nameTranslations}
                    setValueTranslations={(t) => handleUpdate(index, { ...item, nameTranslations: t })}
                    placeholder={t('elements.routeOrderEditor.redirectNamePlaceholder', {})}
                    size='sm'
                  />
                </Box>
              )}

              {!readOnly && (
                <Tooltip label={t('common.tooltip.remove', {})} withArrow>
                  <ActionIcon
                    variant='subtle'
                    color='red'
                    size='sm'
                    onClick={() => handleRemove(index)}
                    style={{ flexShrink: 0 }}
                  >
                    <FontAwesomeIcon icon={faTrash} style={{ fontSize: 12 }} />
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>

            <Box pl={30}>
              {!readOnly ? (
                <TextInput
                  size='sm'
                  placeholder={t('elements.routeOrderEditor.destinationPlaceholder', {})}
                  value={item.destination}
                  onChange={(e) => handleUpdate(index, { ...item, destination: e.currentTarget.value })}
                />
              ) : item.destination ? (
                <Text size='xs' c='dimmed'>
                  → {item.destination}
                </Text>
              ) : null}
            </Box>
          </Stack>
        </Paper>
      );
    }

    return null;
  };

  return (
    <Stack gap='xs'>
      {value.length > 0 ? (
        <DndContainer
          items={dndItems}
          callbacks={{
            onDragEnd: handleDragEnd,
          }}
          renderOverlay={(activeItem) =>
            activeItem ? <div style={{ cursor: 'grabbing' }}>{renderItem(activeItem)}</div> : null
          }
        >
          {(items) => (
            <Stack gap='xs'>
              {items.map((item) => (
                <SortableItem
                  key={item.id}
                  id={item.id}
                  renderItem={({ dragHandleProps }) =>
                    renderItem(item, dragHandleProps as unknown as ComponentProps<'button'>)
                  }
                />
              ))}
            </Stack>
          )}
        </DndContainer>
      ) : (
        <Text size='sm' c='dimmed' ta='center' py='md'>
          {t('elements.routeOrderEditor.empty', {})}
        </Text>
      )}

      {!readOnly && (
        <>
          <Divider />
          <Group gap='xs'>
            <Select
              size='sm'
              value={addType}
              onChange={(v) => setAddType((v as 'route' | 'divider' | 'redirect') ?? 'route')}
              data={[
                { value: 'route', label: t('elements.routeOrderEditor.label.route', {}) },
                { value: 'divider', label: t('elements.routeOrderEditor.label.divider', {}) },
                { value: 'redirect', label: t('elements.routeOrderEditor.label.redirect', {}) },
              ]}
              allowDeselect={false}
              w={120}
            />

            {addType === 'route' && (
              <Select
                size='sm'
                placeholder={t('elements.routeOrderEditor.selectRoutePlaceholder', {})}
                data={availableRoutes.map((r) => ({
                  value: r.path,
                  label: typeof r.name === 'string' ? r.name : r.name!(),
                }))}
                onChange={(path) => {
                  if (path) handleAddRoute(path);
                }}
                value={null}
                searchable
                clearable
                style={{ flex: 1 }}
                disabled={availableRoutes.length === 0}
              />
            )}

            {addType !== 'route' && (
              <Button
                size='sm'
                variant='light'
                leftSection={<FontAwesomeIcon icon={faPlus} style={{ fontSize: 12 }} />}
                onClick={addType === 'divider' ? handleAddDivider : handleAddRedirect}
              >
                {addType === 'divider'
                  ? t('elements.routeOrderEditor.button.addDivider', {})
                  : t('elements.routeOrderEditor.button.addRedirect', {})}
              </Button>
            )}
          </Group>
        </>
      )}
    </Stack>
  );
}
