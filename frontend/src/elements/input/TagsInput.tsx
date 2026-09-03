import {
  faCheck,
  faClipboard,
  faGripVertical,
  faPaste,
  faPencil,
  faTrash,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group, Input, Menu, Stack, StyleProp, Text } from '@mantine/core';
import { ComponentProps, ReactNode, startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { makeComponentHookable } from 'shared';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import Button from '@/elements/buttons/Button.tsx';
import Card from '@/elements/data-display/Card.tsx';
import { DndContainer, DndItem, SortableItem } from '@/elements/dnd/DragAndDrop.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import ScrollingText from '@/elements/ScrollingText.tsx';
import { handleRawCopyToClipboard } from '@/lib/clipboard/copy.ts';
import { handleRawPasteFromClipboard } from '@/lib/clipboard/paste.ts';
import { restrictToVerticalAxis } from '@/lib/dragAndDrop.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

function splitTagLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

interface TagsInputProps {
  label?: ReactNode;
  description?: string;
  error?: ReactNode;
  withAsterisk?: boolean;
  allowReordering?: boolean;
  value?: string[];
  defaultValue?: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  allowDuplicates?: boolean;
  flex?: StyleProp<React.CSSProperties['flex']>;
}

interface DndTag extends DndItem {
  id: string;
  value: string;
}

function TagsInput({
  label,
  description,
  error,
  withAsterisk,
  allowReordering = true,
  value,
  defaultValue = [],
  onChange,
  placeholder = 'Add tag...',
  allowDuplicates = false,
  flex,
}: TagsInputProps) {
  const { t } = useTranslations();
  const { addToast } = useToast();

  const [selectedTags, setSelectedTags] = useState<string[]>(value ?? defaultValue);
  const [newTag, setNewTag] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!value) return;

    setSelectedTags((current) =>
      current.length === value.length && current.every((tag, i) => tag === value[i]) ? current : value,
    );
  }, [value]);

  const emitChange = (arr: string[]) => {
    onChange(arr);
  };

  const handleRemove = (index: number) => {
    const next = selectedTags.filter((_, i) => i !== index);
    setSelectedTags(next);
    emitChange(next);
  };

  const appendTags = (tags: string[]) => {
    const next = [...selectedTags];
    for (const tag of tags) {
      if (!allowDuplicates && next.includes(tag)) continue;
      next.push(tag);
    }

    if (next.length === selectedTags.length) {
      setNewTag('');
      return;
    }

    startTransition(() => {
      setSelectedTags(next);
      emitChange(next);
      setNewTag('');
      inputRef.current?.focus();
    });
  };

  const handleAdd = () => {
    appendTags(splitTagLines(newTag));
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    if (!text.includes('\n')) return;

    e.preventDefault();
    appendTags(splitTagLines(text));
  };

  const handleReplaceFromClipboard = (text: string) => {
    const pasted = splitTagLines(text);
    const next = allowDuplicates ? pasted : Array.from(new Set(pasted));

    startTransition(() => {
      setSelectedTags(next);
      emitChange(next);
      setEditingIndex(null);
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

  const dndItems: DndTag[] = useMemo(
    () =>
      selectedTags.map((value, index) => ({
        id: `tag-${index}-${value}`,
        value,
      })),
    [selectedTags],
  );

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
          <Text size='xs' className='flex-1 min-w-0'>
            <ScrollingText>{item.value}</ScrollingText>
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
    <Stack gap='xs' flex={flex}>
      <Stack gap={2}>
        {label && <Input.Label required={withAsterisk}>{label}</Input.Label>}
        {description && <Input.Description>{description}</Input.Description>}
        <Group gap='xs' wrap='nowrap'>
          <TextInput
            ref={inputRef}
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={placeholder}
            size='sm'
            className='flex-1'
            error={!!error}
          />
          <Button onClick={handleAdd} size='sm' disabled={!newTag.trim()}>
            {t('common.button.add', {})}
          </Button>
          <Menu shadow='md' width={200} position='bottom-end'>
            <Menu.Target>
              <ActionIcon size='input-sm' variant='default'>
                <FontAwesomeIcon icon={faClipboard} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={<FontAwesomeIcon icon={faClipboard} />}
                disabled={selectedTags.length === 0}
                onClick={() => handleRawCopyToClipboard(selectedTags.join('\n'), addToast)}
              >
                {t('common.elements.tagsInput.copyAll', {})}
              </Menu.Item>
              <Menu.Item
                leftSection={<FontAwesomeIcon icon={faPaste} />}
                onClick={() => handleRawPasteFromClipboard(handleReplaceFromClipboard, addToast)}
              >
                {t('common.elements.tagsInput.pasteReplace', {})}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
        {error && <Input.Error>{error}</Input.Error>}
      </Stack>

      {selectedTags.length > 0 && (
        <DndContainer
          items={dndItems}
          modifiers={[restrictToVerticalAxis]}
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
