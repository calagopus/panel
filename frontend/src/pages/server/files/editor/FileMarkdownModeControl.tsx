import { faCode, faColumns, faEye } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useShallow } from 'zustand/react/shallow';
import SegmentedControl from '@/elements/layout/SegmentedControl.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import { useFileManager } from '@/providers/FileManagerProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { MarkdownPreviewMode } from '@/stores/fileManager.ts';

const modes = [
  { value: 'edit', icon: faCode },
  { value: 'split', icon: faColumns },
  { value: 'preview', icon: faEye },
] as const;

export default function FileMarkdownModeControl() {
  const { t } = useTranslations();
  const { markdownPreviewMode, setMarkdownPreviewMode } = useFileManager(
    useShallow((state) => ({
      markdownPreviewMode: state.markdownPreviewMode,
      setMarkdownPreviewMode: state.setMarkdownPreviewMode,
    })),
  );

  return (
    <SegmentedControl
      size='xs'
      className='shrink-0'
      value={markdownPreviewMode}
      onChange={(value) => setMarkdownPreviewMode(value as MarkdownPreviewMode)}
      styles={{ label: { padding: 0 } }}
      data={modes.map(({ value, icon }) => ({
        value,
        label: (
          <Tooltip label={t(`pages.server.files.markdown.${value}`, {})}>
            <span className='block' style={{ padding: 'var(--sc-padding)' }}>
              <FontAwesomeIcon icon={icon} aria-label={t(`pages.server.files.markdown.${value}`, {})} />
            </span>
          </Tooltip>
        ),
      }))}
    />
  );
}
