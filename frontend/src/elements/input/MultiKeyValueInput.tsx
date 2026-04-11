import { faCheck, faGripVertical, faPencil, faTrash, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ActionIcon, Badge, Button, Group, Input, Stack, Text, TextInput } from '@mantine/core';
import { ComponentProps, startTransition, useEffect, useRef, useState } from 'react';
import { makeComponentHookable } from 'shared';
import { DndContainer, DndItem, SortableItem } from '@/elements/DragAndDrop.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import Card from '../Card.tsx';

interface MultiKeyValueInputProps {
  label?: string;
  withAsterisk?: boolean;
  allowReordering?: boolean;
  options: Record<string, string>;
  onChange: (selected: Record<string, string>) => void;
  transformValue?: (key: string, value: string) => string;
  hideKey?: (key: string) => boolean;
  placeholderKey?: string;
  placeholderValue?: string;
}

interface DndKeyValue extends DndItem {
  id: string;
  key: string;
  value: string;
}

function MultiKeyValueInput({
  label,
  withAsterisk,
  allowReordering = true,
  options,
  onChange,
  transformValue,
  hideKey,
  placeholderKey = 'Key',
  placeholderValue = 'Value',
}: MultiKeyValueInputProps) {
  const { t } = useTranslations();

  const [selectedOptions, setSelectedOptions] = useState<
    {
      key: string;
      value: string;
    }[]
  >([]);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editKey, setEditKey] = useState('');
  const [editValue, setEditValue] = useState('');
  const keyInputRef = useRef<HTMLInputElement>(null);
  const valueInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const arr = Object.entries(options).map(([key, value]) => ({ key, value }));
    setSelectedOptions(arr);
  }, [options]);

  const emitChange = (arr: { key: string; value: string }[]) => {
    const obj: Record<string, string> = {};
    arr.forEach(({ key, value }) => {
      obj[key] = value;
    });
    onChange(obj);
  };

  const handleRemove = (key: string) => {
    const newOptions = selectedOptions.filter((opt) => opt.key !== key);
    setSelectedOptions(newOptions);
    emitChange(newOptions);
  };

  const handleAdd = () => {
    const trimmedKey = newKey.trim();
    const trimmedValue = newValue.trim();
    if (!trimmedKey || !trimmedValue) return;

    if (selectedOptions.some((opt) => opt.key === trimmedKey)) {
      return;
    }

    startTransition(() => {
      const newOptions = [...selectedOptions, { key: trimmedKey, value: trimmedValue }];
      setSelectedOptions(newOptions);
      emitChange(newOptions);

      setNewKey('');
      setNewValue('');
      keyInputRef.current?.focus();
    });
  };

  const handleStartEdit = (key: string) => {
    const option = selectedOptions.find((opt) => opt.key === key);
    if (!option) return;

    startTransition(() => {
      setEditingKey(key);
      setEditKey(option.key);
      setEditValue(option.value);
    });
  };

  const handleSaveEdit = () => {
    if (editingKey === null) return;

    const trimmedKey = editKey.trim();
    const trimmedValue = editValue.trim();
    if (!trimmedKey || !trimmedValue) return;

    if (selectedOptions.some((opt) => opt.key === trimmedKey && opt.key !== editingKey)) {
      return;
    }

    const newOptions = selectedOptions.map((opt) =>
      opt.key === editingKey ? { key: trimmedKey, value: trimmedValue } : opt,
    );

    startTransition(() => {
      setSelectedOptions(newOptions);
      emitChange(newOptions);
      setEditingKey(null);
    });
  };

  const handleCancelEdit = () => {
    setEditingKey(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (editingKey !== null) {
        handleSaveEdit();
      } else {
        handleAdd();
      }
    } else if (e.key === 'Escape' && editingKey !== null) {
      handleCancelEdit();
    }
  };

  const visibleOptions = selectedOptions.filter(({ key }) => !hideKey?.(key));

  const dndItems: DndKeyValue[] = visibleOptions.map((opt) => ({
    ...opt,
    id: opt.key,
  }));

  const handleDragEnd = (items: DndKeyValue[]) => {
    const reorderedVisible = items.map((item) => ({
      key: item.key,
      value: item.value,
    }));

    const hiddenItems = selectedOptions.filter((opt) => hideKey?.(opt.key));
    const newOptions = [...reorderedVisible, ...hiddenItems];

    startTransition(() => {
      setSelectedOptions(newOptions);
      emitChange(newOptions);
    });
  };

  const renderItem = (item: DndKeyValue, dragHandleProps?: ComponentProps<'button'>) => {
    const { key, value } = item;

    return (
      <Card p={6} className='h-11'>
        {editingKey === key ? (
          <Group gap={4} wrap='nowrap' h='100%' align='center'>
            <ActionIcon size='sm' variant='subtle' color='gray' {...dragHandleProps} hidden={!allowReordering}>
              <FontAwesomeIcon icon={faGripVertical} size='xs' />
            </ActionIcon>
            <TextInput
              value={editKey}
              onChange={(e) => setEditKey(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholderKey}
              size='xs'
              className='flex-1'
              autoFocus
            />
            <TextInput
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholderValue}
              size='xs'
              className='flex-[1.5]'
            />
            <ActionIcon size='sm' variant='light' color='green' onClick={handleSaveEdit}>
              <FontAwesomeIcon icon={faCheck} size='xs' />
            </ActionIcon>
            <ActionIcon size='sm' variant='light' color='gray' onClick={handleCancelEdit}>
              <FontAwesomeIcon icon={faXmark} size='xs' />
            </ActionIcon>
          </Group>
        ) : (
          <Group gap={6} wrap='nowrap' h='100%' align='center'>
            <ActionIcon size='sm' variant='subtle' color='gray' {...dragHandleProps} hidden={!allowReordering}>
              <FontAwesomeIcon icon={faGripVertical} size='xs' />
            </ActionIcon>
            <Badge variant='light' size='sm' radius='sm' className='normal-case!'>
              {key}
            </Badge>
            <Text size='xs' className='flex-1' truncate c='dimmed'>
              {transformValue ? transformValue(key, value) : value}
            </Text>
            <ActionIcon size='sm' variant='subtle' color='blue' onClick={() => handleStartEdit(key)}>
              <FontAwesomeIcon icon={faPencil} size='xs' />
            </ActionIcon>
            <ActionIcon size='sm' variant='subtle' color='red' onClick={() => handleRemove(key)}>
              <FontAwesomeIcon icon={faTrash} size='xs' />
            </ActionIcon>
          </Group>
        )}
      </Card>
    );
  };

  return (
    <Stack gap='xs'>
      <Stack gap={0}>
        {label && <Input.Label required={withAsterisk}>{label}</Input.Label>}
        <div className='grid grid-cols-6 gap-2'>
          <TextInput
            ref={keyInputRef}
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholderKey}
            size='xs'
            className='col-span-2'
          />
          <TextInput
            ref={valueInputRef}
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholderValue}
            size='xs'
            className='col-span-3'
          />
          <Button onClick={handleAdd} size='xs' disabled={!newKey.trim() || !newValue.trim()}>
            {t('common.button.add', {})}
          </Button>
        </div>
      </Stack>

      {visibleOptions.length > 0 && (
        <DndContainer
          items={dndItems}
          callbacks={{
            onDragEnd: handleDragEnd,
          }}
          renderOverlay={(activeItem) =>
            activeItem ? (
              <div style={{ cursor: 'grabbing' }}>{renderItem(activeItem, { style: { cursor: 'grabbing' } })}</div>
            ) : null
          }
        >
          {(items) => (
            <Stack gap={4}>
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
      )}
    </Stack>
  );
}

export default makeComponentHookable(MultiKeyValueInput);
