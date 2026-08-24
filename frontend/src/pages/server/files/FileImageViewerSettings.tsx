import { faCog } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Button from '@/elements/Button.tsx';
import Checkbox from '@/elements/input/Checkbox.tsx';
import Popover from '@/elements/Popover.tsx';
import UserSettingScopeMenu from '@/elements/UserSettingScopeMenu.tsx';
import { useFileManager } from '@/providers/FileManagerProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { fileManagerSettingKey } from '@/stores/fileManager.ts';

export default function FileImageViewerSettings() {
  const { t } = useTranslations();
  const imageViewerSmoothing = useFileManager((state) => state.imageViewerSmoothing);
  const setImageViewerSmoothing = useFileManager((state) => state.setImageViewerSmoothing);

  return (
    <Popover position='bottom' withArrow shadow='md'>
      <Popover.Target>
        <Button variant='transparent' size='compact-xs'>
          <FontAwesomeIcon size='lg' icon={faCog} />
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
        <div className='flex flex-col space-y-2'>
          {window.extensionContext.extensionRegistry.pages.server.files.fileImageViewerSettings.prependedComponents.map(
            (Component, i) => (
              <Component key={`files-imageViewerSettings-prepended-${i}`} />
            ),
          )}

          <Checkbox
            label={
              <span className='inline-flex items-center gap-1'>
                {t('pages.server.files.settings.imageViewerSmoothing', {})}
                <UserSettingScopeMenu
                  settingKey={fileManagerSettingKey('imageViewerSmoothing')}
                  value={imageViewerSmoothing}
                  withinPortal={false}
                />
              </span>
            }
            className='order-10'
            checked={imageViewerSmoothing}
            onChange={(e) => setImageViewerSmoothing(e.target.checked)}
          />

          {window.extensionContext.extensionRegistry.pages.server.files.fileImageViewerSettings.appendedComponents.map(
            (Component, i) => (
              <Component key={`files-imageViewerSettings-appended-${i}`} />
            ),
          )}
        </div>
      </Popover.Dropdown>
    </Popover>
  );
}
