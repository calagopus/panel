import classNames from 'classnames';
import { useEffect, useRef, useState } from 'react';
import { ServerCan } from '@/elements/Can.tsx';
import ChartSyncGroup from '@/elements/charts/ChartSyncGroup.tsx';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import { useNavbarPageHeader } from '@/elements/containers/useNavbarPageHeader.ts';
import Card from '@/elements/data-display/Card.tsx';
import ExtensionSlot from '@/elements/ExtensionSlot.tsx';
import Group from '@/elements/layout/Group.tsx';
import Title from '@/elements/typography/Title.tsx';
import { useContainerAutoHeight } from '@/plugins/viewport/useContainerAutoHeight.ts';
import { usePageBreakpoint } from '@/plugins/viewport/usePageBreakpoint.ts';
import { useVisualViewportBottomInset } from '@/plugins/viewport/useVisualViewport.ts';
import { useCurrentWindow } from '@/providers/CurrentWindowProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import ServerIndicators from './stats/ServerIndicators.tsx';
import ServerMetricTiles from './stats/ServerMetricTiles.tsx';
import ServerPowerControls from './stats/ServerPowerControls.tsx';
import Console from './terminal/Console.tsx';

export default function ServerConsole() {
  const { t } = useTranslations();
  const server = useServerStore((state) => state.server);
  const keyboardInset = useVisualViewportBottomInset();
  const titleHoisted = useNavbarPageHeader({ title: server.name, subtitle: server.description || undefined });
  const detailsInInfobar = usePageBreakpoint('md');
  const hasDesktopSidebar = usePageBreakpoint('lg');
  const alignWithNavbar = titleHoisted && !hasDesktopSidebar;

  const infobarSentinelRef = useRef<HTMLDivElement>(null);
  const [infobarStuck, setInfobarStuck] = useState(false);

  const layoutRef = useRef<HTMLDivElement>(null);
  const infobarRef = useRef<HTMLDivElement>(null);
  const { getParent } = useCurrentWindow();

  useContainerAutoHeight({
    containerRef: layoutRef,
    loading: false,
    getParent,
    layout: () => undefined,
    cssVariable: '--console-fit-height',
    extraObserveRef: infobarRef,
    minHeightFraction: 0.6,
    deps: [getParent, detailsInInfobar, titleHoisted],
  });

  useEffect(() => {
    if (!titleHoisted || !infobarSentinelRef.current) return;

    const stickyTop = 0.75 * (Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16);
    const observer = new IntersectionObserver(
      ([entry]) => setInfobarStuck(!entry.isIntersecting && entry.boundingClientRect.top < stickyTop),
      { rootMargin: `-${stickyTop}px 0px 0px 0px` },
    );
    observer.observe(infobarSentinelRef.current);

    return () => observer.disconnect();
  }, [titleHoisted]);

  const infobar = (
    <Group
      justify='space-between'
      wrap={detailsInInfobar ? 'nowrap' : 'wrap'}
      className={classNames({ 'min-h-12': alignWithNavbar && !detailsInInfobar })}
    >
      <div
        className={classNames('min-w-0 flex-1 flex-col gap-1', titleHoisted && !detailsInInfobar ? 'hidden' : 'flex')}
      >
        <div className={classNames('flex-col', titleHoisted ? 'hidden lg:flex' : 'flex')}>
          <Title order={1}>{server.name}</Title>
          <p className='text-sm text-(--mantine-color-dimmed)!'>{server.description}</p>
        </div>
        {detailsInInfobar && <ServerIndicators />}
      </div>
      <ServerCan action={['control.start', 'control.stop', 'control.restart']} matchAny>
        <ServerPowerControls hideIcons={alignWithNavbar && infobarStuck && !detailsInInfobar} />
      </ServerCan>
    </Group>
  );

  return (
    <ServerContentContainer
      title={t('pages.server.console.title', {})}
      hideTitleComponent
      registry={window.extensionContext.extensionRegistry.pages.server.console.container}
    >
      <div ref={infobarSentinelRef} />
      <div
        ref={infobarRef}
        id='console-infobar'
        className={classNames(
          'sticky z-20 bg-(--mantine-color-body) mb-2 py-2 -mx-4 lg:-mx-6 pr-4 lg:px-6 transition-[padding] duration-150',
          titleHoisted ? 'top-3 lg:top-0 shadow-[0_-0.75rem_0_var(--mantine-color-body)] lg:shadow-none' : 'top-0',
          titleHoisted && infobarStuck ? 'pl-20' : 'pl-4',
        )}
      >
        {detailsInInfobar ? (
          <Card
            px='md'
            py={alignWithNavbar ? 5 : 'sm'}
            className={classNames({ 'min-h-12 justify-center': alignWithNavbar })}
          >
            {infobar}
          </Card>
        ) : (
          infobar
        )}
      </div>

      {!detailsInInfobar && (
        <Card px='md' py='sm' className={classNames('mb-4', { '-mt-1.5': titleHoisted })}>
          <ServerIndicators />
        </Card>
      )}

      <ChartSyncGroup>
        <div
          ref={layoutRef}
          className='grid xl:grid-cols-4 gap-4 mb-4 xl:min-h-[calc(var(--console-fit-height)-var(--console-fit-reserve))]'
        >
          <div
            className='xl:col-span-3 flex flex-col h-[60vh] xl:h-auto'
            style={
              keyboardInset > 0
                ? { height: `max(8rem, min(60vh, calc(100dvh - ${keyboardInset}px - 7rem)))` }
                : undefined
            }
          >
            <Console />
          </div>

          <ServerMetricTiles />
        </div>

        {window.extensionContext.extensionRegistry.pages.server.console.statBlocks.length > 0 && (
          <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
            <ExtensionSlot
              components={window.extensionContext.extensionRegistry.pages.server.console.statBlocks}
              name='console-stat-block'
            />
          </div>
        )}
      </ChartSyncGroup>
    </ServerContentContainer>
  );
}
