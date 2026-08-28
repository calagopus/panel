import Checkbox from '@/elements/input/Checkbox.tsx';
import UserSettingScopeMenu from '@/elements/UserSettingScopeMenu.tsx';
import SettingsPopover from '@/pages/server/files/SettingsPopover.tsx';
import { useFileManager } from '@/providers/FileManagerProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { fileManagerSettingKey } from '@/stores/fileManager.ts';

export default function FileImageViewerSettings() {
  const { t } = useTranslations();
  const imageViewerSmoothing = useFileManager((state) => state.imageViewerSmoothing);
  const setImageViewerSmoothing = useFileManager((state) => state.setImageViewerSmoothing);

  return (
    <SettingsPopover
      registry={window.extensionContext.extensionRegistry.pages.server.files.fileImageViewerSettings}
      keyPrefix='files-imageViewerSettings'
    >
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
    </SettingsPopover>
  );
}
