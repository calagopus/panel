import { faCog } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useShallow } from 'zustand/react/shallow';
import Button from '@/elements/Button.tsx';
import Checkbox from '@/elements/input/Checkbox.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Popover from '@/elements/Popover.tsx';
import { useFileManager } from '@/providers/FileManagerProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function FileEditorSettings() {
  const { t } = useTranslations();
  const {
    editorMinimap,
    editorLineOverflow,
    vscodeUriScheme,
    setEditorMinimap,
    setEditorLineOverflow,
    setVscodeUriScheme,
  } = useFileManager(
    useShallow((state) => ({
      editorMinimap: state.editorMinimap,
      editorLineOverflow: state.editorLineOverflow,
      vscodeUriScheme: state.vscodeUriScheme,
      setEditorMinimap: state.setEditorMinimap,
      setEditorLineOverflow: state.setEditorLineOverflow,
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
          {window.extensionContext.extensionRegistry.pages.server.files.fileEditorSettings.prependedComponents.map(
            (Component, i) => (
              <Component key={`files-editorSettings-prepended-${i}`} />
            ),
          )}

          <Checkbox
            label={t('pages.server.files.settings.editorMinimap', {})}
            className='order-10'
            checked={editorMinimap}
            onChange={(e) => setEditorMinimap(e.target.checked)}
          />
          <Checkbox
            label={t('pages.server.files.settings.editorLineOverflow', {})}
            className='order-20'
            checked={editorLineOverflow}
            onChange={(e) => setEditorLineOverflow(e.target.checked)}
          />
          <TextInput
            label={t('pages.server.files.settings.vscodeUriScheme', {})}
            className='order-30'
            value={vscodeUriScheme}
            onChange={(e) => setVscodeUriScheme(e.target.value)}
          />

          {window.extensionContext.extensionRegistry.pages.server.files.fileEditorSettings.appendedComponents.map(
            (Component, i) => (
              <Component key={`files-editorSettings-appended-${i}`} />
            ),
          )}
        </div>
      </Popover.Dropdown>
    </Popover>
  );
}
