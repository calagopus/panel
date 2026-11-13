import {
  Dispatch,
  MouseEvent as ReactMouseEvent,
  SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { isOverlayActive } from '@/lib/dom/overlayFocus.ts';
import { ObjectSet } from '@/lib/objectSet.ts';
import { useKeyboardShortcuts } from '@/plugins/quick-actions/useKeyboardShortcuts.ts';
import { selectionRange } from '@/plugins/selection/selectionRange.ts';
import { useSelectionArea } from '@/plugins/selection/useSelectionArea.ts';

const unlessOverlay = (action: () => void) => (event: KeyboardEvent) => {
  if (!isOverlayActive(event.target)) action();
};

interface UseTableSelectionOptions<T, K extends string> {
  items?: readonly T[];
  key?: K;
  /** Required when the item has no string property named {@link UseTableSelectionOptions.key}. */
  identify?: (item: T) => string;
  shortcuts?: boolean;
}

export interface TableSelection<T extends object, K extends string> {
  selected: ObjectSet<T, K>;
  setSelected: Dispatch<SetStateAction<ObjectSet<T, K>>>;
  add: (item: T) => void;
  remove: (item: T) => void;
  toggle: (item: T, selected: boolean, range?: boolean) => void;
  replace: (items?: readonly T[]) => void;
  clear: () => void;
  selectAll: () => void;
  allSelected: boolean;
  selectionAreaProps: {
    onSelectedStart: (event: ReactMouseEvent | MouseEvent) => void;
    onSelected: (items: T[]) => void;
  };
}

export function useTableSelection<T extends Record<K, string>, const K extends string = 'uuid'>(
  options?: UseTableSelectionOptions<T, K>,
): TableSelection<T, K>;

export function useTableSelection<T extends object, const K extends string = 'uuid'>(
  options: UseTableSelectionOptions<T, K> & { identify: (item: T) => string },
): TableSelection<T, K>;

export function useTableSelection<T extends object, const K extends string = 'uuid'>({
  items,
  key = 'uuid' as K,
  identify,
  shortcuts = true,
}: UseTableSelectionOptions<T, K> = {}): TableSelection<T, K> {
  const identifyRef = useRef(identify);

  useEffect(() => {
    identifyRef.current = identify;
  });

  const identifyItem = useCallback(
    (item: T) => identifyRef.current?.(item) ?? (item as unknown as Record<K, string>)[key],
    [key],
  );

  const create = useCallback(
    (entries?: readonly T[]) => new ObjectSet<T, K>(key, entries ? [...entries] : undefined, identifyItem),
    [key, identifyItem],
  );

  const [selected, setSelected] = useState(() => create());

  const itemsRef = useRef(items);
  const anchorRef = useRef<string | null>(null);

  useEffect(() => {
    itemsRef.current = items;
  });

  // Selection tracks the rows currently on screen: paging away drops them, and a refetch swaps the
  // held objects for the freshly loaded ones so action bars never act on a stale snapshot.
  useEffect(() => {
    if (!items) return;

    setSelected((previous) => {
      if (previous.size === 0) return previous;

      const next = items.filter((item) => previous.has(identifyItem(item)));
      const unchanged =
        next.length === previous.size && next.every((item) => previous.get(identifyItem(item)) === item);

      return unchanged ? previous : create(next);
    });
  }, [items, identifyItem, create]);

  const clear = useCallback(() => setSelected(create()), [create]);
  const replace = useCallback((next?: readonly T[]) => setSelected(create(next)), [create]);
  const selectAll = useCallback(() => setSelected(create(items)), [create, items]);

  const add = useCallback((item: T) => setSelected((previous) => previous.clone().add(item)), []);
  const remove = useCallback(
    (item: T) =>
      setSelected((previous) => {
        const next = previous.clone();
        next.delete(item);

        return next;
      }),
    [],
  );

  const toggle = useCallback(
    (item: T, isSelected: boolean, range = false) => {
      const affected = range ? selectionRange(itemsRef.current ?? [], anchorRef.current, item, identifyItem) : [item];
      anchorRef.current = identifyItem(item);

      setSelected((previous) => {
        const next = previous.clone();
        for (const entry of affected) {
          if (isSelected) {
            next.add(entry);
          } else {
            next.delete(entry);
          }
        }

        return next;
      });
    },
    [identifyItem],
  );

  const { onSelectedStart, onSelected } = useSelectionArea<T>({
    identify: identifyItem,
    getSelected: () => selected.values(),
    setSelected: (values) => setSelected(create(values)),
  });

  useKeyboardShortcuts({
    enabled: shortcuts,
    shortcuts: [
      { id: 'table.selectAll', callback: unlessOverlay(selectAll) },
      { id: 'table.deselectAll', callback: unlessOverlay(clear) },
    ],
    deps: [selectAll, clear],
  });

  return {
    selected,
    setSelected,
    add,
    remove,
    toggle,
    replace,
    clear,
    selectAll,
    allSelected: (items?.length ?? 0) > 0 && selected.size >= (items?.length ?? 0),
    selectionAreaProps: { onSelectedStart, onSelected },
  };
}
