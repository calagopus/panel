import { useComputedColorScheme } from '@mantine/core';
import classNames from 'classnames';
import { makeComponentHookable } from 'shared';
import { useGlobalStore } from '@/stores/global.ts';

function AppIcon({ className }: { className?: string }) {
  const settings = useGlobalStore((state) => state.settings);
  const isLight = useComputedColorScheme('dark') === 'light';

  return settings.app.banner ? (
    <div className={classNames('w-full mt-1 select-none', className)}>
      <img
        src={isLight ? (settings.app.bannerLight ?? settings.app.banner) : settings.app.banner}
        className='w-full h-auto'
        alt='Calagopus Banner'
      />
    </div>
  ) : (
    <div className={classNames('h-16 w-full flex flex-row items-center justify-between mt-1 select-none', className)}>
      <img
        src={isLight ? (settings.app.iconLight ?? settings.app.icon) : settings.app.icon}
        className='h-12 w-12'
        alt='Calagopus Icon'
      />
      <h1 className='grow text-md font-bold! ml-2'>{settings.app.name}</h1>
    </div>
  );
}

export default makeComponentHookable(AppIcon);
