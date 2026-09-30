import classNames from 'classnames';
import { useEffect, useRef, useState } from 'react';
import { ServerCan } from '@/elements/Can.tsx';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import { useNavbarPageHeader } from '@/elements/containers/useNavbarPageHeader.ts';
import Group from '@/elements/layout/Group.tsx';
import Title from '@/elements/typography/Title.tsx';
import { useVisualViewportBottomInset } from '@/plugins/viewport/useVisualViewport.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import ServerDetails from './stats/ServerDetails.tsx';
import ServerPowerControls from './stats/ServerPowerControls.tsx';
import ServerStats from './stats/ServerStats.tsx';
import Console from './terminal/Console.tsx';

export default function ServerConsole() {
  const { t } = useTranslations();
  const server = useServerStore((state) => state.server);
  const keyboardInset = useVisualViewportBottomInset();
  const titleHoisted = useNavbarPageHeader({ title: server.name, subtitle: server.description || undefined });

  const infobarSentinelRef = useRef<HTMLDivElement>(null);
  const [infobarStuck, setInfobarStuck] = useState(false);

  useEffect(() => {
    if (!titleHoisted || !infobarSentinelRef.current) return;

    const observer = new IntersectionObserver(([entry]) =>
      setInfobarStuck(!entry.isIntersecting && entry.boundingClientRect.top < 0),
    );
    observer.observe(infobarSentinelRef.current);

    return () => observer.disconnect();
  }, [titleHoisted]);

  return (
    <ServerContentContainer
      title={t('pages.server.console.title', {})}
      hideTitleComponent
      registry={window.extensionContext.extensionRegistry.pages.server.console.container}
    >
      <div ref={infobarSentinelRef} />
      <div
        id='console-infobar'
        className={classNames(
          'sticky z-20 bg-(--mantine-color-body) mb-4 py-2 -mx-4 lg:-mx-6 pr-4 lg:px-6 transition-[padding] duration-150',
          titleHoisted ? 'top-3 lg:top-0 shadow-[0_-0.75rem_0_var(--mantine-color-body)] lg:shadow-none' : 'top-0',
          titleHoisted && infobarStuck ? 'pl-20' : 'pl-4',
        )}
      >
        <Group justify='space-between' className={classNames({ 'min-h-12 lg:min-h-0': titleHoisted })}>
          <div className={classNames('flex-col', titleHoisted ? 'hidden lg:flex' : 'flex')}>
            <Title order={1}>{server.name}</Title>
            <p className='text-sm text-(--mantine-color-dimmed)!'>{server.description}</p>
          </div>
          <ServerCan action={['control.start', 'control.stop', 'control.restart']} matchAny>
            <ServerPowerControls />
          </ServerCan>
        </Group>
      </div>

      <div className='grid xl:grid-cols-4 gap-4 mb-4'>
        <div
          className='xl:col-span-3 flex flex-col h-[60vh] xl:h-auto'
          style={
            keyboardInset > 0 ? { height: `max(8rem, min(60vh, calc(100dvh - ${keyboardInset}px - 7rem)))` } : undefined
          }
        >
          <Console />
        </div>

        <div className='flex flex-col min-w-0'>
          <ServerDetails />
        </div>
      </div>

      <ServerStats />
    </ServerContentContainer>
  );
}
