import {
  Active,
  CollisionDetection,
  closestCenter,
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  Modifier,
  Over,
} from '@dnd-kit/core';
import { SortableContext, SortingStrategy, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ComponentProps, CSSProperties, ReactNode, useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { createDropAnimation, useDndSensors, useDndState } from '@/lib/dragAndDrop.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export type DndItem = {
  id: string;
};

export interface DndConfig {
  pointerActivationDistance?: number;
  touchActivationDelay?: number;
  touchActivationTolerance?: number;
  dragOverlayDuration?: number;
  dragOverlayEasing?: string;
}

export interface DndCallbacks<T extends DndItem> {
  onDragStart?: (item: T) => void;
  onDragOver?: (activeId: string, overId: string | null) => void;
  onDragEnd: (items: T[], oldIndex: number, newIndex: number) => void | Promise<void>;
  onDragCancel?: () => void;
  onError?: (error: unknown, originalItems: T[]) => void;
}

export interface SortableItemProps {
  id: string;
  children?: ReactNode;
  disabled?: boolean;
  data?: Record<string, unknown>;
  transitionDuration?: number;
  transitionEasing?: string;
  renderItem?: (props: { isDragging: boolean; dragHandleProps: ComponentProps<'div'> }) => ReactNode;
}

export function SortableItem({
  id,
  children,
  disabled = false,
  data,
  transitionDuration = 300,
  transitionEasing = 'cubic-bezier(0.25, 1, 0.5, 1)',
  renderItem,
}: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
    data,
    transition: {
      duration: transitionDuration,
      easing: transitionEasing,
    },
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    touchAction: isDragging ? 'none' : 'manipulation',
  };

  const dragHandleProps = useMemo(
    () => ({
      ...attributes,
      ...listeners,
      style: {
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: isDragging ? 'none' : 'manipulation',
      } satisfies CSSProperties,
    }),
    [attributes, listeners, isDragging],
  );

  return (
    <div ref={setNodeRef} style={style} className='min-w-0'>
      {renderItem ? (
        renderItem({ isDragging, dragHandleProps })
      ) : (
        <div {...dragHandleProps} className='h-full min-w-0'>
          {children}
        </div>
      )}
    </div>
  );
}

export interface DndSortableListProps {
  id?: string;
  items: string[];
  strategy?: SortingStrategy;
  disabled?: boolean;
  children: ReactNode;
}

export function DndSortableList({
  id,
  items,
  strategy = verticalListSortingStrategy,
  disabled = false,
  children,
}: DndSortableListProps) {
  return (
    <SortableContext id={id} items={items} strategy={strategy} disabled={disabled}>
      {children}
    </SortableContext>
  );
}

interface DndShellProps {
  config: DndConfig;
  collisionDetection: CollisionDetection;
  modifiers?: Modifier[];
  describeItem: (item: Active | Over) => string;
  overlay: ReactNode;
  onDragStart?: (event: DragStartEvent) => void;
  onDragOver?: (event: DragOverEvent) => void;
  onDragEnd?: (event: DragEndEvent) => void;
  onDragCancel?: () => void;
  children: ReactNode;
}

function DndShell({
  config,
  collisionDetection,
  modifiers,
  describeItem,
  overlay,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDragCancel,
  children,
}: DndShellProps) {
  const { t } = useTranslations();

  const sensors = useDndSensors(config);
  const dropAnimation = useMemo(() => createDropAnimation(config), [config]);

  const accessibility = useMemo(() => {
    return {
      announcements: {
        onDragStart: ({ active }) => t('elements.dragAndDrop.announcement.pickedUp', { item: describeItem(active) }),
        onDragOver: ({ active, over }) =>
          over
            ? t('elements.dragAndDrop.announcement.movedOver', {
                item: describeItem(active),
                target: describeItem(over),
              })
            : t('elements.dragAndDrop.announcement.leftTarget', { item: describeItem(active) }),
        onDragEnd: ({ active, over }) =>
          over
            ? t('elements.dragAndDrop.announcement.droppedOn', {
                item: describeItem(active),
                target: describeItem(over),
              })
            : t('elements.dragAndDrop.announcement.dropped', { item: describeItem(active) }),
        onDragCancel: ({ active }) => t('elements.dragAndDrop.announcement.cancelled', { item: describeItem(active) }),
      },
    } satisfies ComponentProps<typeof DndContext>['accessibility'];
  }, [describeItem, t]);

  const swallowNextClick = useCallback(() => {
    const swallow = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
    };

    window.addEventListener('click', swallow, { capture: true, once: true });
    window.setTimeout(() => window.removeEventListener('click', swallow, true), 250);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      swallowNextClick();
      onDragEnd?.(event);
    },
    [onDragEnd, swallowNextClick],
  );

  const handleDragCancel = useCallback(() => {
    swallowNextClick();
    onDragCancel?.();
  }, [onDragCancel, swallowNextClick]);

  return (
    <DndContext
      sensors={sensors}
      modifiers={modifiers}
      accessibility={accessibility}
      collisionDetection={collisionDetection}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {children}
      {createPortal(
        <DragOverlay dropAnimation={dropAnimation} style={{ pointerEvents: 'none' }}>
          {overlay}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  );
}

export interface DndBoardProps {
  config?: DndConfig;
  collisionDetection?: CollisionDetection;
  modifiers?: Modifier[];
  describeItem?: (item: Active | Over) => string;
  renderOverlay?: (active: Active | null) => ReactNode;
  onDragStart?: (event: DragStartEvent) => void;
  onDragOver?: (event: DragOverEvent) => void;
  onDragEnd?: (event: DragEndEvent) => void | Promise<void>;
  onDragCancel?: () => void;
  children: ReactNode;
}

const defaultConfig: DndConfig = {};
const defaultDescribeItem = (item: Active | Over) => String(item.id);

export function DndBoard({
  config = defaultConfig,
  collisionDetection = closestCenter,
  modifiers,
  describeItem = defaultDescribeItem,
  renderOverlay,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDragCancel,
  children,
}: DndBoardProps) {
  const [active, setActive] = useState<Active | null>(null);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      setActive(event.active);
      onDragStart?.(event);
    },
    [onDragStart],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActive(null);
      onDragEnd?.(event);
    },
    [onDragEnd],
  );

  const handleDragCancel = useCallback(() => {
    setActive(null);
    onDragCancel?.();
  }, [onDragCancel]);

  return (
    <DndShell
      config={config}
      collisionDetection={collisionDetection}
      modifiers={modifiers}
      describeItem={describeItem}
      overlay={renderOverlay ? renderOverlay(active) : null}
      onDragStart={handleDragStart}
      onDragOver={onDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {children}
    </DndShell>
  );
}

export interface DndContainerProps<T extends DndItem> {
  items: T[];
  callbacks: DndCallbacks<T>;
  config?: DndConfig;
  id?: string;
  strategy?: SortingStrategy;
  collisionDetection?: CollisionDetection;
  children: (items: T[]) => ReactNode;
  renderOverlay?: (activeItem: T | null) => ReactNode;
  modifiers?: Modifier[];
  getItemLabel?: (item: T) => string;
}

export function DndContainer<T extends DndItem>({
  items,
  callbacks,
  config = defaultConfig,
  id,
  strategy = verticalListSortingStrategy,
  collisionDetection = closestCenter,
  children,
  renderOverlay,
  modifiers,
  getItemLabel,
}: DndContainerProps<T>) {
  const { t } = useTranslations();

  const { activeItem, localItems, handleDragStart, handleDragOver, handleDragEnd, handleDragCancel } = useDndState(
    items,
    callbacks,
  );

  const itemIds = useMemo(() => localItems.map((item) => item.id), [localItems]);

  const describeItem = useCallback(
    (target: Active | Over) => {
      const index = localItems.findIndex((item) => item.id === target.id);
      if (index === -1) return String(target.id);

      const label = getItemLabel?.(localItems[index]);
      return label
        ? t('elements.dragAndDrop.item.labelled', { label, position: index + 1 })
        : t('elements.dragAndDrop.item.unlabelled', { position: index + 1 });
    },
    [localItems, getItemLabel, t],
  );

  return (
    <DndShell
      config={config}
      collisionDetection={collisionDetection}
      modifiers={modifiers}
      describeItem={describeItem}
      overlay={renderOverlay && activeItem ? renderOverlay(activeItem) : null}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <DndSortableList id={id} items={itemIds} strategy={strategy}>
        {children(localItems)}
      </DndSortableList>
    </DndShell>
  );
}
