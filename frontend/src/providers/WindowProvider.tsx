import { Window } from '@gfazioli/mantine-window';
import { FC, ReactNode, startTransition, useCallback, useMemo, useRef, useState } from 'react';
import { CurrentWindowProvider } from '@/providers/CurrentWindowProvider.tsx';
import { WindowContext } from '@/providers/contexts/windowContext.ts';

const MAX_WINDOWS = 32;
const BASE_Z_INDEX = 100;

interface WindowType {
  id: number;
  title: string;
  component: ReactNode;
  zIndex: number;
}

const WindowProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [windows, setWindows] = useState<WindowType[]>([]);
  const windowId = useRef(1);

  const closeWindow = useCallback((id: number) => {
    setWindows((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const closeAllWindows = useCallback(() => {
    setWindows([]);
  }, []);

  const addWindow = useCallback(
    (title: string, component: ReactNode) => {
      if (windows.length >= MAX_WINDOWS) return -1;

      const id = windowId.current++;

      startTransition(() => {
        setWindows((prev) => [...prev, { id, title, component, zIndex: BASE_Z_INDEX + prev.length }]);
      });

      return id;
    },
    [windows.length],
  );

  const updateWindow = useCallback((id: number, title: string) => {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, title } : w)));
  }, []);

  const _bringToFront = useCallback((id: number) => {
    startTransition(() => {
      setWindows((prev) => {
        const target = prev.find((w) => w.id === id);
        if (!target) return prev;

        const isOnTop = prev.every((w) => w.id === id || w.zIndex < target.zIndex);
        if (isOnTop) return prev;

        const others = prev.filter((w) => w.id !== id).sort((a, b) => a.zIndex - b.zIndex);

        const reindexed = new Map<number, number>();
        others.forEach((w, i) => reindexed.set(w.id, BASE_Z_INDEX + i));
        reindexed.set(id, BASE_Z_INDEX + others.length);

        return prev.map((w) => ({ ...w, zIndex: reindexed.get(w.id)! }));
      });
    });
  }, []);

  const contextValue = useMemo(
    () => ({
      addWindow,
      updateWindow,
      closeWindow,
      closeAllWindows,
    }),
    [addWindow, updateWindow, closeWindow, closeAllWindows],
  );

  return (
    <WindowContext.Provider value={contextValue}>
      {children}
      <Window.Group withinPortal>
        {windows.map((w) => (
          <Window
            id={`window_${w.id}`}
            key={`window_${w.id}`}
            title={w.title}
            controlsPosition={navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? 'left' : 'right'}
            draggable='header'
            opened
            onClose={() => closeWindow(w.id)}
            defaultWidth='50%'
            defaultHeight='50%'
          >
            <CurrentWindowProvider id={w.id}>{w.component}</CurrentWindowProvider>
          </Window>
        ))}
      </Window.Group>
    </WindowContext.Provider>
  );
};

export { useWindows } from './contexts/windowContext.ts';
export { WindowProvider };
