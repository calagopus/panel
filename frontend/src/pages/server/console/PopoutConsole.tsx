import { useEffect } from 'react';
import { ServerCan } from '@/elements/Can.tsx';
import Card from '@/elements/data-display/Card.tsx';
import Group from '@/elements/layout/Group.tsx';
import Title from '@/elements/typography/Title.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useRelativePageStore } from '@/stores/relativePage.ts';
import { useServerStore } from '@/stores/server.ts';
import ServerIndicators from './stats/ServerIndicators.tsx';
import ServerPowerControls from './stats/ServerPowerControls.tsx';
import Console from './terminal/Console.tsx';

export default function PopoutConsole() {
  const { t } = useTranslations();
  const server = useServerStore((state) => state.server);
  const setTitle = useRelativePageStore((state) => state.setTitle);

  useEffect(() => {
    const label = t('pages.server.console.popout.windowTitle', {});
    setTitle(server.name ? `${server.name} - ${label}` : label);
  }, [server.name, setTitle, t]);

  return (
    <div className='fixed-viewport z-[120] flex flex-col gap-4 bg-(--mantine-color-body) p-4'>
      <Card px='md' py='sm' className='shrink-0'>
        <Group justify='space-between' wrap='nowrap'>
          <div className='min-w-0 flex-1 flex flex-col gap-1'>
            <div className='flex flex-col min-w-0'>
              <Title order={1} className='truncate'>
                {server.name}
              </Title>
              {server.description && (
                <p className='text-sm text-(--mantine-color-dimmed)! truncate'>{server.description}</p>
              )}
            </div>
            <ServerIndicators />
          </div>
          <ServerCan action={['control.start', 'control.stop', 'control.restart']} matchAny>
            <ServerPowerControls />
          </ServerCan>
        </Group>
      </Card>

      <div className='flex-1 min-h-0 flex flex-col'>
        <Console popout />
      </div>
    </div>
  );
}
