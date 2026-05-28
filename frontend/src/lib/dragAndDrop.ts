import {
  DragEndEvent,
  DragStartEvent,
  DropAnimation,
  defaultDropAnimationSideEffects,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useEffect, useState } from 'react';
import { DndCallbacks, DndConfig, DndItem } from '@/elements/DragAndDrop.tsx';

export function useDndSensors(config: DndConfig = {}) {
  const { pointerActivationDistance = 8, touchActivationDelay = 250, touchActivationTolerance = 8 } = config;

  return useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: pointerActivationDistance,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: touchActivationDelay,
        tolerance: touchActivationTolerance,
      },
    }),
  );
}

export function useDndState<T extends DndItem>(items: T[], callbacks: DndCallbacks<T>) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [localItems, setLocalItems] = useState<T[]>(items);

  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  const handleDragStart = (event: DragStartEvent) => {
    const activeItem = items.find((item) => item.id === event.active.id);
    setActiveId(event.active.id as string);

    if (activeItem && callbacks.onDragStart) {
      callbacks.onDragStart(activeItem);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const oldIndex = localItems.findIndex((item) => item.id === active.id);
    const newIndex = localItems.findIndex((item) => item.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reorderedItems = arrayMove(localItems, oldIndex, newIndex);
    setLocalItems(reorderedItems);

    try {
      await callbacks.onDragEnd(reorderedItems, oldIndex, newIndex);
    } catch (error) {
      setLocalItems(items);
      if (callbacks.onError) callbacks.onError(error, items);
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
    if (callbacks.onDragCancel) callbacks.onDragCancel();
  };

  const activeItem = activeId ? localItems.find((item) => item.id === activeId) : null;

  return {
    activeId,
    activeItem,
    localItems,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
  };
}

export function createDropAnimation(config: DndConfig = {}): DropAnimation {
  const { dragOverlayDuration = 300, dragOverlayEasing = 'cubic-bezier(0.25, 1, 0.5, 1)' } = config;

  return {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: '0.5',
        },
      },
    }),
    duration: dragOverlayDuration,
    easing: dragOverlayEasing,
  };
}
