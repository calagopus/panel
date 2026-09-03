import { useMantineColorScheme } from '@mantine/core';
import classNames from 'classnames';
import { ReactNode, Suspense } from 'react';
import { ClipLoader } from 'react-spinners';
import { makeComponentHookable } from 'shared';

function Spinner({ size }: { size?: number }) {
  const { colorScheme } = useMantineColorScheme();

  return (
    <ClipLoader
      size={size}
      aria-label='Loading Spinner'
      data-testid='loader'
      color={colorScheme === 'dark' ? '#fff' : '#000'}
    />
  );
}

export default makeComponentHookable(Spinner, {
  Centered: makeComponentHookable(({ size, className }: { size?: number; className?: string }) => (
    <div className={classNames('flex items-center justify-center py-6', className)}>
      <Spinner size={size} />
    </div>
  )),
  Suspense: makeComponentHookable(({ children, className }: { children: ReactNode; className?: string }) => (
    <Suspense
      fallback={
        <div className={classNames('flex items-center justify-center', className)}>
          <Spinner />
        </div>
      }
    >
      {children}
    </Suspense>
  )),
});
