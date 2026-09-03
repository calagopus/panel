import { useCallback, useState } from 'react';
import { ObjectSet } from '@/lib/objectSet.ts';
import { useKeyboardShortcuts } from '@/plugins/quick-actions/useKeyboardShortcuts.ts';
import { useSelectionArea } from '@/plugins/selection/useSelectionArea.ts';

interface UseAdminTableSelectionOptions<K extends string> {
  items?: readonly unknown[];
  key?: K;
  shortcuts?: boolean;
}

export function useAdminTableSelection<T extends Record<K, string>, K extends string = 'uuid'>({
  items,
  key = 'uuid' as K,
  shortcuts = true,
}: UseAdminTableSelectionOptions<K> = {}) {
  const [selected, setSelected] = useState(() => new ObjectSet<T, K>(key));

  const clear = useCallback(() => setSelected(new ObjectSet<T, K>(key)), [key]);

  const toggle = useCallback((item: T, isSelected: boolean) => {
    setSelected((prev) => {
      const next = prev.clone();
      if (isSelected) {
        next.add(item);
      } else {
        next.delete(item);
      }
      return next;
    });
  }, []);

  const { onSelectedStart, onSelected } = useSelectionArea<T>({
    identify: (item) => item[key],
    getSelected: () => selected.values(),
    setSelected: (values) => setSelected(new ObjectSet<T, K>(key, values)),
  });

  useKeyboardShortcuts({
    enabled: shortcuts,
    shortcuts: [
      {
        key: 'a',
        modifiers: ['ctrlOrMeta'],
        callback: () => setSelected(new ObjectSet<T, K>(key, (items as T[] | undefined) ?? [])),
      },
      { key: 'Escape', callback: clear },
    ],
    deps: [items],
  });

  return {
    selected,
    setSelected,
    clear,
    toggle,
    selectionAreaProps: { onSelectedStart, onSelected },
  };
}
