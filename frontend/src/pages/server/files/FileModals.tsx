import ArchiveCreateModal from '@/pages/server/files/modals/ArchiveCreateModal.tsx';
import DirectoryNameModal from '@/pages/server/files/modals/DirectoryNameModal.tsx';
import FileCopyModal from '@/pages/server/files/modals/FileCopyModal.tsx';
import FileCopyRemoteModal from '@/pages/server/files/modals/FileCopyRemoteModal.tsx';
import FileDeleteModal from '@/pages/server/files/modals/FileDeleteModal.tsx';
import FileFingerprintModal from '@/pages/server/files/modals/FileFingerprintModal.tsx';
import FilePermissionsModal from '@/pages/server/files/modals/FilePermissionsModal.tsx';
import FileRenameModal from '@/pages/server/files/modals/FileRenameModal.tsx';
import FileSearchModal from '@/pages/server/files/modals/FileSearchModal.tsx';
import LargestDirectoriesModal from '@/pages/server/files/modals/LargestDirectoriesModal.tsx';
import PullFileModal from '@/pages/server/files/modals/PullFileModal.tsx';
import SftpDetailsModal from '@/pages/server/files/modals/SftpDetailsModal.tsx';
import { useFileManager } from '@/providers/contexts/fileManagerContext.ts';
import FileDetailsModal from './modals/FileDetailsModal.tsx';

export default function FileModals() {
  const { openModal, modalDirectoryEntries, doCloseModal } = useFileManager();

  return (
    <>
      <FileCopyModal file={modalDirectoryEntries[0]} opened={openModal === 'copy'} onClose={doCloseModal} />
      <FileCopyRemoteModal files={modalDirectoryEntries} opened={openModal === 'copy-remote'} onClose={doCloseModal} />
      <FileRenameModal file={modalDirectoryEntries[0]} opened={openModal === 'rename'} onClose={doCloseModal} />
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
      <FileDeleteModal files={modalDirectoryEntries} opened={openModal === 'delete'} onClose={doCloseModal} />

      <SftpDetailsModal opened={openModal === 'sftpDetails'} onClose={doCloseModal} />
      <DirectoryNameModal opened={openModal === 'nameDirectory'} onClose={doCloseModal} />
      <PullFileModal opened={openModal === 'pullFile'} onClose={doCloseModal} />

      <FileSearchModal opened={openModal === 'search'} onClose={doCloseModal} />

      <LargestDirectoriesModal opened={openModal === 'largestDirectories'} onClose={doCloseModal} />
    </>
  );
}
