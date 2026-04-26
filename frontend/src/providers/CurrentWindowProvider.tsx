import { FC, ReactNode, useCallback, useMemo } from 'react';
import { CurrentWindowContext } from '@/providers/contexts/currentWindowContext.ts';

const CurrentWindowProvider: FC<{ children: ReactNode; id: number | null }> = ({ children, id }) => {
  const getParent = useCallback(() => {
    if (!id) {
      return null;
    }

    return (document.getElementById(`window_${id}_inner`) as HTMLDivElement) || null;
  }, [id]);

  const contextValue = useMemo(
    () => ({
      id,
      getParent,
    }),
    [id, getParent],
  );

  return (
    <CurrentWindowContext.Provider value={contextValue}>
      <div id={`window_${id}_inner`} className='h-full'>
        {children}
      </div>
    </CurrentWindowContext.Provider>
  );
};

export { useCurrentWindow } from './contexts/currentWindowContext.ts';
export { CurrentWindowProvider };
