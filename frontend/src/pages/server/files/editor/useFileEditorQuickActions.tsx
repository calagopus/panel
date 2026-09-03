import { faArrowsRotate, faClockRotateLeft, faFileCirclePlus, faFloppyDisk } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { CORE_QUICK_ACTION_CATEGORIES } from '@/lib/quickActions/coreQuickActions.tsx';
import { useQuickActions } from '@/plugins/quick-actions/useQuickActions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

interface FileEditorQuickActionsOptions {
  action?: string;
  fileName: string;
  writable: boolean;
  primary: boolean;
  saving: boolean;
  dirty: boolean;
  collaborationActive: boolean;
  collaborationDeleted: boolean;
  onSave: () => void;
  onCreate: () => void;
  onShowRevisions: () => void;
  onRevert: () => void;
}

export default function useFileEditorQuickActions({
  action,
  fileName,
  writable,
  primary,
  saving,
  dirty,
  collaborationActive,
  collaborationDeleted,
  onSave,
  onCreate,
  onShowRevisions,
  onRevert,
}: FileEditorQuickActionsOptions) {
  const { t } = useTranslations();

  useQuickActions([
    {
      id: 'files.editor.save',
      category: CORE_QUICK_ACTION_CATEGORIES.page,
      label: () => t('pages.server.files.quickAction.saveFile', {}),
      icon: <FontAwesomeIcon icon={faFloppyDisk} />,
      permission: collaborationActive ? 'files.update' : 'files.create',
      isVisible: () => action === 'edit' && !!fileName && writable && !saving,
      perform: onSave,
    },
    {
      id: 'files.editor.create',
      category: CORE_QUICK_ACTION_CATEGORIES.page,
      label: () => t('pages.server.files.quickAction.createFile', {}),
      icon: <FontAwesomeIcon icon={faFileCirclePlus} />,
      permission: 'files.create',
      isVisible: () => action === 'new' && writable && !saving,
      perform: onCreate,
    },
    {
      id: 'files.editor.revisions',
      category: CORE_QUICK_ACTION_CATEGORIES.page,
      label: () => t('pages.server.files.tooltip.fileHistory', {}),
      keywords: ['revisions', 'versions'],
      icon: <FontAwesomeIcon icon={faClockRotateLeft} />,
      permission: 'files.read-content',
      isVisible: () => action === 'edit' && !!fileName && primary,
      perform: onShowRevisions,
    },
    {
      id: 'files.editor.revertToDisk',
      category: CORE_QUICK_ACTION_CATEGORIES.page,
      label: () => t('pages.server.files.tooltip.revertToDisk', {}),
      keywords: ['revert', 'discard'],
      icon: <FontAwesomeIcon icon={faArrowsRotate} />,
      permission: collaborationActive ? 'files.update' : 'files.read-content',
      isVisible: () => dirty && action === 'edit' && !!fileName && writable && !collaborationDeleted,
      perform: onRevert,
    },
  ]);
}
