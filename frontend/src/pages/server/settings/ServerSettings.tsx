import { ServerCan } from '@/elements/Can.tsx';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import ExtensionSlot from '@/elements/ExtensionSlot.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import AutokillContainer from './AutokillContainer.tsx';
import AutostartContainer from './AutostartContainer.tsx';
import DebugInformationContainer from './DebugInformationContainer.tsx';
import ReinstallContainer from './ReinstallContainer.tsx';
import RenameContainer from './RenameContainer.tsx';
import TimezoneContainer from './TimezoneContainer.tsx';

export default function ServerSettings() {
  const { t } = useTranslations();

  return (
    <ServerContentContainer
      title={t('pages.server.settings.title', {})}
      registry={window.extensionContext.extensionRegistry.pages.server.settings.container}
    >
      <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-2'>
        <ExtensionSlot
          components={
            window.extensionContext.extensionRegistry.pages.server.settings.settingContainers.prependedComponents
          }
          name='settings-settingContainer-prepended'
        />

        <DebugInformationContainer />
        <ServerCan action='settings.rename'>
          <RenameContainer />
        </ServerCan>
        <ServerCan action='settings.auto-kill'>
          <AutokillContainer />
        </ServerCan>
        <ServerCan action='settings.auto-start'>
          <AutostartContainer />
        </ServerCan>
        <ServerCan action='settings.timezone'>
          <TimezoneContainer />
        </ServerCan>
        <ServerCan action='settings.install'>
          <ReinstallContainer />
        </ServerCan>

        <ExtensionSlot
          components={
            window.extensionContext.extensionRegistry.pages.server.settings.settingContainers.appendedComponents
          }
          name='settings-settingContainer-appended'
        />
      </div>
    </ServerContentContainer>
  );
}
