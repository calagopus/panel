import { useShallow } from 'zustand/react/shallow';
import Checkbox from '@/elements/input/Checkbox.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Select from '@/elements/input/Select.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import UserSettingScopeMenu from '@/elements/UserSettingScopeMenu.tsx';
import SettingsPopover from '@/pages/server/files/SettingsPopover.tsx';
import { useFileManager } from '@/providers/FileManagerProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { fileManagerSettingKey } from '@/stores/fileManager.ts';

export default function FileEditorSettings() {
  const { t } = useTranslations();
  const {
    editorMinimap,
    editorLineOverflow,
    editorFontSize,
    editorEngine,
    vscodeUriScheme,
    setEditorMinimap,
    setEditorLineOverflow,
    setEditorFontSize,
    setEditorEngine,
    setVscodeUriScheme,
  } = useFileManager(
    useShallow((state) => ({
      editorMinimap: state.editorMinimap,
      editorLineOverflow: state.editorLineOverflow,
      editorFontSize: state.editorFontSize,
      editorEngine: state.editorEngine,
      vscodeUriScheme: state.vscodeUriScheme,
      setEditorMinimap: state.setEditorMinimap,
      setEditorLineOverflow: state.setEditorLineOverflow,
      setEditorFontSize: state.setEditorFontSize,
      setEditorEngine: state.setEditorEngine,
      setVscodeUriScheme: state.setVscodeUriScheme,
    })),
  );

  return (
    <SettingsPopover
      tooltip={t('pages.server.files.tooltip.settings', {})}
      registry={window.extensionContext.extensionRegistry.pages.server.files.fileEditorSettings}
      keyPrefix='files-editorSettings'
    >
      {editorEngine === 'monaco' && (
        <Checkbox
          label={
            <span className='inline-flex items-center gap-1'>
              {t('pages.server.files.settings.editorMinimap', {})}
              <UserSettingScopeMenu
                settingKey={fileManagerSettingKey('editorMinimap')}
                value={editorMinimap}
                withinPortal={false}
              />
            </span>
          }
          className='order-10'
          checked={editorMinimap}
          onChange={(e) => setEditorMinimap(e.target.checked)}
        />
      )}
      <Checkbox
        label={t('pages.server.files.settings.editorLineOverflow', {})}
        className='order-20'
        checked={editorLineOverflow}
        onChange={(e) => setEditorLineOverflow(e.target.checked)}
      />
      <NumberInput
        label={
          <span className='inline-flex items-center gap-1'>
            {t('pages.server.files.settings.editorFontSize', {})}
            <UserSettingScopeMenu
              settingKey={fileManagerSettingKey('editorFontSize')}
              value={editorFontSize}
              withinPortal={false}
            />
          </span>
        }
        className='order-25'
        min={6}
        max={72}
        value={editorFontSize}
        onChange={(value) => setEditorFontSize(Number(value) || 14)}
      />
      <Select
        label={t('pages.server.files.settings.editorEngine', {})}
        className='order-27'
        value={editorEngine}
        onChange={(value) => setEditorEngine(value === 'pierre' ? 'pierre' : 'monaco')}
        data={[
          { value: 'monaco', label: 'Monaco' },
          { value: 'pierre', label: 'Pierre' },
        ]}
      />
      <TextInput
        label={t('pages.server.files.settings.vscodeUriScheme', {})}
        className='order-30'
        value={vscodeUriScheme}
        onChange={(e) => setVscodeUriScheme(e.target.value)}
      />
    </SettingsPopover>
  );
}
