import { Group, Title } from '@mantine/core';
import { ServerCan } from '@/elements/Can.tsx';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import Console from './Console.tsx';
import ServerDetails from './ServerDetails.tsx';
import ServerPowerControls from './ServerPowerControls.tsx';
import ServerStats from './ServerStats.tsx';

export default function ServerConsole() {
  const { t } = useTranslations();
  const server = useServerStore((state) => state.server);

  return (
    <ServerContentContainer
      title={t('pages.server.console.title', {})}
      hideTitleComponent
      registry={window.extensionContext.extensionRegistry.pages.server.console.container}
    >
      <div className='sticky top-0 z-10 bg-neutral-850 mb-4 py-2 -mx-4 lg:-mx-6 px-4 lg:px-6'>
        <Group justify='space-between'>
          <div className='flex flex-col'>
            <Title order={1} c='white'>
              {server.name}
            </Title>
            <p className='text-sm text-gray-300!'>{server.description}</p>
          </div>
          <ServerCan action={['control.start', 'control.stop', 'control.restart']} matchAny>
            <ServerPowerControls />
          </ServerCan>
        </Group>
      </div>

      <div className='grid xl:grid-cols-4 gap-4 mb-4'>
        <div className='xl:col-span-3 flex flex-col h-[60vh] xl:h-auto'>
          <Console />
        </div>

        <div className='flex flex-col'>
          <ServerDetails />
        </div>
      </div>

      <ServerStats />
    </ServerContentContainer>
  );
}
