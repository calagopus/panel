import { useCallback, useState } from 'react';
import { ObjectSet } from '@/lib/objectSet.ts';
import { useKeyboardShortcuts } from '@/plugins/quick-actions/useKeyboardShortcuts.ts';
import { useSelectionArea } from '@/plugins/selection/useSelectionArea.ts';

interface UseObjectSetSelectionOptions {
  shortcuts?: boolean;
}

export function useObjectSetSelection<T extends Record<'uuid', string>>(
  items: T[] | undefined,
  { shortcuts = true }: UseObjectSetSelectionOptions = {},
) {
  const [selected, setSelected] = useState(new ObjectSet<T, 'uuid'>('uuid'));

  const replace = useCallback((next?: T[]) => setSelected(new ObjectSet('uuid', next)), []);
  const clear = useCallback(() => setSelected(new ObjectSet('uuid')), []);
  const selectAll = useCallback(() => setSelected(new ObjectSet('uuid', items)), [items]);

  const add = useCallback((item: T) => setSelected((prev) => prev.clone().add(item)), []);
  const remove = useCallback(
    (item: T) =>
      setSelected((prev) => {
        const next = prev.clone();
        next.delete(item);
        return next;
      }),
    [],
  );

  const { onSelectedStart, onSelected } = useSelectionArea<T>({
    identify: (item) => item.uuid,
    getSelected: () => selected.values(),
    setSelected: (next) => setSelected(new ObjectSet('uuid', next)),
  });

  useKeyboardShortcuts({
    shortcuts: shortcuts
      ? [
          { key: 'a', modifiers: ['ctrlOrMeta'], callback: selectAll },
          { key: 'Escape', callback: clear },
        ]
      : [],
    deps: [items, selectAll, clear],
  });

  return {
    selected,
    setSelected,
    add,
    remove,
    clear,
    replace,
    selectAll,
    selectionAreaProps: { onSelectedStart, onSelected },
  };
}
