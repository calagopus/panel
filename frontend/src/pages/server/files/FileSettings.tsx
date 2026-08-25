import { faCog } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useShallow } from 'zustand/react/shallow';
import Button from '@/elements/Button.tsx';
import Checkbox from '@/elements/input/Checkbox.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Popover from '@/elements/Popover.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import UserSettingScopeMenu from '@/elements/UserSettingScopeMenu.tsx';
import { useFileManager } from '@/providers/FileManagerProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { fileManagerSettingKey } from '@/stores/fileManager.ts';

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
        <Tooltip label={t('pages.server.files.tooltip.settings', {})}>
          <Button variant='transparent' size='compact-xs' aria-label={t('pages.server.files.tooltip.settings', {})}>
            <FontAwesomeIcon size='lg' icon={faCog} />
          </Button>
        </Tooltip>
      </Popover.Target>
      <Popover.Dropdown>
        <div className='flex flex-col space-y-2'>
          {window.extensionContext.extensionRegistry.pages.server.files.fileSettings.prependedComponents.map(
            (Component, i) => (
              <Component key={`files-settings-prepended-${i}`} />
            ),
          )}

          <Checkbox
            label={
              <span className='inline-flex items-center gap-1'>
                {t('pages.server.files.settings.clickOnce', {})}
                <UserSettingScopeMenu
                  settingKey={fileManagerSettingKey('clickOnce')}
                  value={clickOnce}
                  withinPortal={false}
                />
              </span>
            }
            checked={clickOnce}
            onChange={(e) => setClickOnce(e.target.checked)}
          />
          <Checkbox
            label={
              <span className='inline-flex items-center gap-1'>
                {t('pages.server.files.settings.preferPhysicalSize', {})}
                <UserSettingScopeMenu
                  settingKey={fileManagerSettingKey('preferPhysicalSize')}
                  value={preferPhysicalSize}
                  withinPortal={false}
                />
              </span>
            }
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
