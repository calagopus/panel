import { MouseEvent as ReactMouseEvent, useCallback, useRef } from 'react';

type SelectionMode = 'replace' | 'add' | 'toggle';

interface UseSelectionAreaOptions<T> {
  identify: (item: T) => string;
  getSelected: () => T[];
  setSelected: (items: T[]) => void;
}

function dedupe<T>(items: T[], identify: (item: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    const id = identify(item);
    if (!seen.has(id)) {
      seen.add(id);
      result.push(item);
    }
  }

  return result;
}

export function useSelectionArea<T>({ identify, getSelected, setSelected }: UseSelectionAreaOptions<T>) {
  const previousRef = useRef<T[]>([]);
  const modeRef = useRef<SelectionMode>('replace');

  const onSelectedStart = useCallback(
    (event: ReactMouseEvent | MouseEvent) => {
      if (event.ctrlKey || event.metaKey) {
        modeRef.current = 'toggle';
        previousRef.current = getSelected();
      } else if (event.shiftKey) {
        modeRef.current = 'add';
        previousRef.current = getSelected();
      } else {
        modeRef.current = 'replace';
        previousRef.current = [];
      }
    },
    [getSelected],
  );

  const onSelected = useCallback(
    (selected: T[]) => {
      if (modeRef.current === 'toggle') {
        const boxed = new Set(selected.map(identify));
        const previousIds = new Set(previousRef.current.map(identify));

        setSelected([
          ...previousRef.current.filter((item) => !boxed.has(identify(item))),
          ...selected.filter((item) => !previousIds.has(identify(item))),
        ]);
        return;
      }

      setSelected(dedupe([...previousRef.current, ...selected], identify));
    },
    [identify, setSelected],
  );

  return { onSelectedStart, onSelected };
}
