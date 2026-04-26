import { Window } from '@gfazioli/mantine-window';
import { FC, ReactNode, startTransition, useCallback, useMemo, useRef, useState } from 'react';
import { CurrentWindowProvider } from '@/providers/CurrentWindowProvider.tsx';
import { WindowContext } from '@/providers/contexts/windowContext.ts';

const MAX_WINDOWS = 32;

interface WindowType {
  id: number;
  title: string;
  component: ReactNode;
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
        setWindows((prev) => [...prev, { id, title, component }]);
      });

      return id;
    },
    [windows.length],
  );

  const updateWindow = useCallback((id: number, title: string) => {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, title } : w)));
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
      <Window.Group withinPortal zIndexStrategy='normalize' initialZIndex={100} showToolsButton={false}>
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
            withScrollArea={false}
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
