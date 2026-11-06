import { lazy, Suspense, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import ArchiveCreateModal from '@/pages/server/files/modals/ArchiveCreateModal.tsx';
import DirectoryNameModal from '@/pages/server/files/modals/DirectoryNameModal.tsx';
import FileCopyModal from '@/pages/server/files/modals/FileCopyModal.tsx';
import FileCopyRemoteModal from '@/pages/server/files/modals/FileCopyRemoteModal.tsx';
import FileDeleteModal from '@/pages/server/files/modals/FileDeleteModal.tsx';
import FileExtractModal from '@/pages/server/files/modals/FileExtractModal.tsx';
import FileFingerprintModal from '@/pages/server/files/modals/FileFingerprintModal.tsx';
import FilePermissionsModal from '@/pages/server/files/modals/FilePermissionsModal.tsx';
import FileRenameModal from '@/pages/server/files/modals/FileRenameModal.tsx';
import FileSearchModal from '@/pages/server/files/modals/FileSearchModal.tsx';
import IncompleteUploadsModal from '@/pages/server/files/modals/IncompleteUploadsModal.tsx';
import MassRenameModal from '@/pages/server/files/modals/MassRenameModal.tsx';
import PullFileModal from '@/pages/server/files/modals/PullFileModal.tsx';
import SymlinkNameModal from '@/pages/server/files/modals/SymlinkNameModal.tsx';
import TrashItemRestoreConflictModal from '@/pages/server/files/trash/entry/TrashItemRestoreConflictModal.tsx';
import TrashItemRestoreToModal from '@/pages/server/files/trash/entry/TrashItemRestoreToModal.tsx';
import { trashItemTargets } from '@/pages/server/files/trash/entry/trashItems.ts';
import { useTrashItemRestoreFinished } from '@/pages/server/files/trash/entry/useTrashItemRestore.ts';
import { useFileManager } from '@/providers/contexts/fileManagerContext.ts';
import FileDetailsModal from '../modals/FileDetailsModal.tsx';

const LargestDirectoriesModal = lazy(() => import('@/pages/server/files/modals/LargestDirectoriesModal.tsx'));

export default function FileModals({ treeView = false }: { treeView?: boolean }) {
  const {
    openModal,
    modalDirectoryEntries,
    browsingDirectory,
    browsingTrashEntry,
    trashRestoreConflicts,
    setTrashRestoreConflicts,
    doCloseModal,
  } = useFileManager(
    useShallow((state) => ({
      openModal: state.openModal,
      modalDirectoryEntries: state.modalDirectoryEntries,
      browsingDirectory: state.browsingDirectory,
      browsingTrashEntry: state.browsingTrashEntry,
      trashRestoreConflicts: state.trashRestoreConflicts,
      setTrashRestoreConflicts: state.setTrashRestoreConflicts,
      doCloseModal: state.doCloseModal,
    })),
  );
  const onTrashRestoreFinished = useTrashItemRestoreFinished();
  const [largestDirectoriesMounted, setLargestDirectoriesMounted] = useState(false);
  if (openModal === 'largestDirectories' && !largestDirectoriesMounted) setLargestDirectoriesMounted(true);

  return (
    <>
      <FileCopyModal file={modalDirectoryEntries[0]} opened={openModal === 'copy'} onClose={doCloseModal} />
      <FileCopyRemoteModal files={modalDirectoryEntries} opened={openModal === 'copy-remote'} onClose={doCloseModal} />
      <FileRenameModal file={modalDirectoryEntries[0]} opened={openModal === 'rename'} onClose={doCloseModal} />
      <MassRenameModal files={modalDirectoryEntries} opened={openModal === 'mass-rename'} onClose={doCloseModal} />
      <FileDetailsModal file={modalDirectoryEntries[0]} opened={openModal === 'details'} onClose={doCloseModal} />
      <FileFingerprintModal
        file={modalDirectoryEntries[0]}
        opened={openModal === 'fingerprint'}
        onClose={doCloseModal}
      />
      <FilePermissionsModal
        file={modalDirectoryEntries[0]}
        opened={openModal === 'permissions'}
        onClose={doCloseModal}
      />
      <ArchiveCreateModal files={modalDirectoryEntries} opened={openModal === 'archive'} onClose={doCloseModal} />
      <FileExtractModal file={modalDirectoryEntries[0]} opened={openModal === 'extract'} onClose={doCloseModal} />
      <FileDeleteModal files={modalDirectoryEntries} opened={openModal === 'delete'} onClose={doCloseModal} />

      <DirectoryNameModal opened={openModal === 'nameDirectory'} onClose={doCloseModal} />
      <SymlinkNameModal
        file={modalDirectoryEntries[0] ?? null}
        opened={openModal === 'nameSymlink'}
        onClose={doCloseModal}
      />
      <PullFileModal opened={openModal === 'pullFile'} onClose={doCloseModal} />

      <FileSearchModal treeView={treeView} opened={openModal === 'search'} onClose={doCloseModal} />

      {largestDirectoriesMounted && (
        <Suspense fallback={null}>
          <LargestDirectoriesModal opened={openModal === 'largestDirectories'} onClose={doCloseModal} />
        </Suspense>
      )}

      <IncompleteUploadsModal opened={openModal === 'incompleteUploads'} onClose={doCloseModal} />

      {browsingTrashEntry && (
        <>
          <TrashItemRestoreToModal
            entry={browsingTrashEntry}
            targets={trashItemTargets(browsingDirectory, modalDirectoryEntries)}
            opened={openModal === 'trashRestoreTo'}
            onClose={doCloseModal}
            onFinished={onTrashRestoreFinished}
          />
          <TrashItemRestoreConflictModal
            entry={browsingTrashEntry}
            conflicts={trashRestoreConflicts}
            opened={openModal === 'trashRestoreConflict'}
            onClose={doCloseModal}
            onResolved={(remaining) => {
              if (remaining.length > 0) {
                setTrashRestoreConflicts(remaining);
              } else {
                doCloseModal();
              }
              onTrashRestoreFinished();
            }}
            onUndone={onTrashRestoreFinished}
          />
        </>
      )}
    </>
  );
}
