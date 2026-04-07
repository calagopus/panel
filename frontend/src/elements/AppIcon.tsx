import classNames from 'classnames';
import { makeComponentHookable } from 'shared';
import { useGlobalStore } from '@/stores/global.ts';

function AppIcon({ className }: { className?: string }) {
  const { settings } = useGlobalStore();

  return settings.app.banner ? (
    <div className={classNames('h-32 w-full mt-1 select-none', className)}>
      <img src={settings.app.banner} className='h-32 w-auto object-cover' alt='Calagopus Banner' />
    </div>
  ) : (
    <div className={classNames('h-16 w-full flex flex-row items-center justify-between mt-1 select-none', className)}>
      <img src={settings.app.icon} className='h-12 w-12' alt='Calagopus Icon' />
      <h1 className='grow text-md font-bold! ml-2'>{settings.app.name}</h1>
    </div>
  );
}

export default makeComponentHookable(AppIcon);
