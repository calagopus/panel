import {
  faArrowUp,
  faClipboard,
  faDoorOpen,
  faDownload,
  faFileCirclePlus,
  faFileUpload,
  faFolderOpen,
  faFolderPlus,
  faMagnifyingGlassChart,
  faSearch,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { join } from 'pathe';
import { createSearchParams, useNavigate, useSearchParams } from 'react-router';
import { handleRawCopyToClipboard } from '@/lib/copy.ts';
import { CORE_QUICK_ACTION_CATEGORIES } from '@/lib/quickActions/coreQuickActions.tsx';
import { useQuickActions } from '@/plugins/useQuickActions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useFileManagerApi } from '@/stores/fileManager.ts';
import { useServerStore } from '@/stores/server.ts';

export function useFileBrowserQuickActions() {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const server = useServerStore((state) => state.server);
  const store = useFileManagerApi();

  const page = CORE_QUICK_ACTION_CATEGORIES.page;
  const isWritable = () => store.getState().browsingWritableDirectory;

  useQuickActions([
    {
      id: 'files.newFile',
      category: page,
      label: () => t('pages.server.files.quickAction.newFile', {}),
      icon: <FontAwesomeIcon icon={faFileCirclePlus} />,
      permission: 'files.create',
      isVisible: isWritable,
      perform: () =>
        navigate(
          `/server/${server.uuidShort}/files/new?${createSearchParams({ directory: store.getState().browsingDirectory })}`,
        ),
    },
    {
      id: 'files.newDirectory',
      category: page,
      label: () => t('pages.server.files.quickAction.newDirectory', {}),
      keywords: ['folder', 'mkdir'],
      icon: <FontAwesomeIcon icon={faFolderPlus} />,
      permission: 'files.create',
      isVisible: isWritable,
      perform: () => store.getState().doOpenModal('nameDirectory'),
    },
    {
      id: 'files.pullFile',
      category: page,
      label: () => t('pages.server.files.quickAction.pullFile', {}),
      keywords: ['url', 'download', 'wget'],
      icon: <FontAwesomeIcon icon={faDownload} />,
      permission: 'files.create',
      isVisible: isWritable,
      perform: () => store.getState().doOpenModal('pullFile'),
    },
    {
      id: 'files.uploadFiles',
      category: page,
      label: () => t('pages.server.files.quickAction.uploadFiles', {}),
      icon: <FontAwesomeIcon icon={faFileUpload} />,
      permission: 'files.create',
      isVisible: isWritable,
      perform: () => store.getState().fileInputRef.current?.click(),
    },
    {
      id: 'files.uploadDirectory',
      category: page,
      label: () => t('pages.server.files.quickAction.uploadDirectory', {}),
      keywords: ['folder'],
      icon: <FontAwesomeIcon icon={faFolderOpen} />,
      permission: 'files.create',
      isVisible: isWritable,
      perform: () => store.getState().folderInputRef.current?.click(),
    },
    {
      id: 'files.search',
      category: page,
      label: () => t('pages.server.files.quickAction.search', {}),
      keywords: ['find', 'grep'],
      icon: <FontAwesomeIcon icon={faSearch} />,
      permission: 'files.read',
      perform: () => store.getState().doOpenModal('search'),
    },
    {
      id: 'files.largestDirectories',
      category: page,
      label: () => t('pages.server.files.quickAction.largestDirectories', {}),
      keywords: ['largest', 'disk', 'usage', 'size'],
      icon: <FontAwesomeIcon icon={faMagnifyingGlassChart} />,
      permission: 'files.read',
      isVisible: () => store.getState().browsingPrimaryFilesystem,
      perform: () => store.getState().doOpenModal('largestDirectories'),
    },
    {
      id: 'files.parentDirectory',
      category: page,
      label: () => t('pages.server.files.quickAction.parentDirectory', {}),
      keywords: ['up', 'back'],
      icon: <FontAwesomeIcon icon={faArrowUp} />,
      perform: () =>
        setSearchParams({
          directory: join(store.getState().browsingDirectory, '..'),
        }),
      isVisible: () => {
        const { browsingDirectory, browsingBackup, searchInfo } = store.getState();
        const directory = join('/', browsingDirectory);

        return !searchInfo && directory !== '/' && directory !== (browsingBackup && `/.backups/${browsingBackup.uuid}`);
      },
    },
    {
      id: 'files.copyPath',
      category: page,
      label: () => t('pages.server.files.quickAction.copyPath', {}),
      keywords: ['clipboard', 'directory'],
      icon: <FontAwesomeIcon icon={faClipboard} />,
      perform: () => handleRawCopyToClipboard(join('/', store.getState().browsingDirectory), addToast),
    },
    {
      id: 'files.exitBackup',
      category: page,
      label: () => t('pages.server.files.quickAction.exitBackup', {}),
      icon: <FontAwesomeIcon icon={faDoorOpen} />,
      isVisible: () => store.getState().browsingBackup !== null,
      perform: () => navigate(`/server/${server.uuidShort}/files`),
    },
  ]);
}
