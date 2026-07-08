import { faCog } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useShallow } from 'zustand/react/shallow';
import Button from '@/elements/Button.tsx';
import Checkbox from '@/elements/input/Checkbox.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Popover from '@/elements/Popover.tsx';
import { useFileManager } from '@/providers/FileManagerProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function FileSettings() {
  const { t } = useTranslations();
  const { clickOnce, preferPhysicalSize, vscodeUriScheme, setClickOnce, setPreferPhysicalSize, setVscodeUriScheme } =
    useFileManager(
      useShallow((state) => ({
        clickOnce: state.clickOnce,
        preferPhysicalSize: state.preferPhysicalSize,
        vscodeUriScheme: state.vscodeUriScheme,
        setClickOnce: state.setClickOnce,
        setPreferPhysicalSize: state.setPreferPhysicalSize,
        setVscodeUriScheme: state.setVscodeUriScheme,
      })),
    );

  return (
    <Popover position='bottom' withArrow shadow='md'>
      <Popover.Target>
        <Button variant='transparent' size='compact-xs'>
          <FontAwesomeIcon size='lg' icon={faCog} />
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
        <div className='flex flex-col space-y-2'>
          {window.extensionContext.extensionRegistry.pages.server.files.fileSettings.prependedComponents.map(
            (Component, i) => (
              <Component key={`files-settings-prepended-${i}`} />
            ),
          )}

          <Checkbox
            label={t('pages.server.files.settings.clickOnce', {})}
            checked={clickOnce}
            onChange={(e) => setClickOnce(e.target.checked)}
          />
          <Checkbox
            label={t('pages.server.files.settings.preferPhysicalSize', {})}
            checked={preferPhysicalSize}
            onChange={(e) => setPreferPhysicalSize(e.target.checked)}
          />
          <TextInput
            label={t('pages.server.files.settings.vscodeUriScheme', {})}
            value={vscodeUriScheme}
            onChange={(e) => setVscodeUriScheme(e.target.value)}
          />

          {window.extensionContext.extensionRegistry.pages.server.files.fileSettings.appendedComponents.map(
            (Component, i) => (
              <Component key={`files-settings-appended-${i}`} />
            ),
          )}
        </div>
      </Popover.Dropdown>
    </Popover>
  );
}
