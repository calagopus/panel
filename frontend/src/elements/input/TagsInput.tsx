import { faCheck, faGripVertical, faPencil, faTrash, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group, Input, Stack, Text } from '@mantine/core';
import { ComponentProps, startTransition, useEffect, useRef, useState } from 'react';
import { makeComponentHookable } from 'shared';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Button from '@/elements/Button.tsx';
import Card from '@/elements/Card.tsx';
import { DndContainer, DndItem, SortableItem } from '@/elements/DragAndDrop.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

interface TagsInputProps {
  label?: string;
  description?: string;
  withAsterisk?: boolean;
  allowReordering?: boolean;
  value?: string[];
  defaultValue?: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  allowDuplicates?: boolean;
}

interface DndTag extends DndItem {
  id: string;
  value: string;
}

function TagsInput({
  label,
  description,
  withAsterisk,
  allowReordering = true,
  value = [],
  defaultValue = [],
  onChange,
  placeholder = 'Add tag...',
  allowDuplicates = false,
}: TagsInputProps) {
  const { t } = useTranslations();

  const [selectedTags, setSelectedTags] = useState<string[]>(defaultValue);
  const [newTag, setNewTag] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (value.length) {
      setSelectedTags(value);
    }
  }, [value]);

  const emitChange = (arr: string[]) => {
    onChange(arr);
  };

  const handleRemove = (index: number) => {
    const next = selectedTags.filter((_, i) => i !== index);
    setSelectedTags(next);
    emitChange(next);
  };

  const handleAdd = () => {
    const trimmed = newTag.trim();
    if (!trimmed) return;
    if (!allowDuplicates && selectedTags.includes(trimmed)) return;

    startTransition(() => {
      const next = [...selectedTags, trimmed];
      setSelectedTags(next);
      emitChange(next);
      setNewTag('');
      inputRef.current?.focus();
    });
  };

  const handleStartEdit = (index: number) => {
    startTransition(() => {
      setEditingIndex(index);
      setEditValue(selectedTags[index]);
    });
  };

  const handleSaveEdit = () => {
    if (editingIndex === null) return;

    const trimmed = editValue.trim();
    if (!trimmed) return;
    if (!allowDuplicates && selectedTags.some((t, i) => t === trimmed && i !== editingIndex)) return;

    const next = selectedTags.map((t, i) => (i === editingIndex ? trimmed : t));

    startTransition(() => {
      setSelectedTags(next);
      emitChange(next);
      setEditingIndex(null);
    });
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (editingIndex !== null) {
        handleSaveEdit();
      } else {
        handleAdd();
      }
    } else if (e.key === 'Escape' && editingIndex !== null) {
      handleCancelEdit();
    }
  };

  const dndItems: DndTag[] = selectedTags.map((value, index) => ({
    id: `tag-${index}-${value}`,
    value,
  }));

  const handleDragEnd = (items: DndTag[]) => {
    const next = items.map((item) => item.value);
    startTransition(() => {
      setSelectedTags(next);
      emitChange(next);
    });
  };

  const renderItem = (item: DndTag, index: number, dragHandleProps?: ComponentProps<'button'>) => (
    <Card p={6} className='h-11'>
      {editingIndex === index ? (
        <Group gap={4} wrap='nowrap' h='100%' align='center'>
          <ActionIcon size='sm' variant='subtle' color='gray' {...dragHandleProps} hidden={!allowReordering}>
            <FontAwesomeIcon icon={faGripVertical} size='xs' />
          </ActionIcon>
          <TextInput
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            size='xs'
            className='flex-1'
            autoFocus
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
          <Text size='xs' truncate className='flex-1'>
            {item.value}
          </Text>
          <ActionIcon size='sm' variant='subtle' color='blue' onClick={() => handleStartEdit(index)}>
            <FontAwesomeIcon icon={faPencil} size='xs' />
          </ActionIcon>
          <ActionIcon size='sm' variant='subtle' color='red' onClick={() => handleRemove(index)}>
            <FontAwesomeIcon icon={faTrash} size='xs' />
          </ActionIcon>
        </Group>
      )}
    </Card>
  );

  return (
    <Stack gap='xs'>
      <Stack gap={0}>
        {label && <Input.Label required={withAsterisk}>{label}</Input.Label>}
        {description && <Input.Description>{description}</Input.Description>}
        <Group gap='xs' wrap='nowrap'>
          <TextInput
            ref={inputRef}
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            size='xs'
            className='flex-1'
          />
          <Button onClick={handleAdd} size='xs' disabled={!newTag.trim()}>
            {t('common.button.add', {})}
          </Button>
        </Group>
      </Stack>

      {selectedTags.length > 0 && (
        <DndContainer
          items={dndItems}
          callbacks={{ onDragEnd: handleDragEnd }}
          renderOverlay={(activeItem) => {
            if (!activeItem) return null;
            const index = dndItems.findIndex((d) => d.id === activeItem.id);
            return (
              <div style={{ cursor: 'grabbing' }}>
                {renderItem(activeItem, index, { style: { cursor: 'grabbing' } })}
              </div>
            );
          }}
        >
          {(items) => (
            <Stack gap={4}>
              {items.map((item, index) => (
                <SortableItem
                  key={item.id}
                  id={item.id}
                  renderItem={({ dragHandleProps }) =>
                    renderItem(item, index, dragHandleProps as unknown as ComponentProps<'button'>)
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

export default makeComponentHookable(TagsInput);
