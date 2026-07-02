import { Window } from '@gfazioli/mantine-window';
import { FC, ReactNode, startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const windowCount = useRef(0);
  useEffect(() => {
    windowCount.current = windows.length;
  }, [windows.length]);

  const closeWindow = useCallback((id: number) => {
    setWindows((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const closeAllWindows = useCallback(() => {
    setWindows([]);
  }, []);

  const addWindow = useCallback((title: string, component: ReactNode) => {
    if (windowCount.current >= MAX_WINDOWS) return -1;

    const id = windowId.current++;
    windowCount.current++;

    startTransition(() => {
      setWindows((prev) => [...prev, { id, title, component }]);
    });

    return id;
  }, []);

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
            shadow='xl'
            onClose={() => closeWindow(w.id)}
            defaultWidth='50%'
            defaultHeight='50%'
            withScrollArea={false}
            styles={{ content: { overscrollBehavior: 'contain' } }}
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
