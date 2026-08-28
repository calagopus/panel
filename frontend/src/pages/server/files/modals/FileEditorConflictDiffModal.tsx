import { RefObject } from 'react';
import Button from '@/elements/Button.tsx';
import { ServerCan } from '@/elements/Can.tsx';
import { MonacoDiffEditor } from '@/elements/MonacoEditor.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { PierreDiffEditor } from '@/elements/PierreEditor.tsx';
import Spinner from '@/elements/Spinner.tsx';
import { useFileManager } from '@/providers/FileManagerProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

interface FileEditorConflictDiffModalProps {
  opened: boolean;
  onClose: () => void;
  conflictDiskContent: string | null;
  conflictModifiedContent: string;
  fileName: string;
  getEditorValue: () => string;
  conflictModelsRef: RefObject<{ dispose: () => void }[]>;
  onKeepEditor: () => void;
  onLoadDisk: () => void;
}

export default function FileEditorConflictDiffModal({
  opened,
  onClose,
  conflictDiskContent,
  conflictModifiedContent,
  fileName,
  getEditorValue,
  conflictModelsRef,
  onKeepEditor,
  onLoadDisk,
}: FileEditorConflictDiffModalProps) {
  const { t } = useTranslations();
  const editorEngine = useFileManager((state) => state.editorEngine);
  const editorLineOverflow = useFileManager((state) => state.editorLineOverflow);

  return (
    <Modal
      title={t('pages.server.files.modal.collabConflictDiff.title', {})}
      opened={opened}
      onClose={onClose}
      size='90%'
    >
      {conflictDiskContent === null ? (
        <div className='w-full h-[70vh] flex items-center justify-center'>
          <Spinner />
        </div>
      ) : (
        <div className='h-[70vh] flex'>
          {editorEngine === 'pierre' ? (
            <PierreDiffEditor
              height='100%'
              width='100%'
              originalPath={`${fileName} (Disk)`}
              originalValue={conflictDiskContent ?? ''}
              modifiedPath={`${fileName} (Editor)`}
              modifiedValue={conflictModifiedContent}
              readOnly
              wordWrap={editorLineOverflow}
            />
          ) : (
            <MonacoDiffEditor
              height='100%'
              width='100%'
              options={{
                readOnly: true,
                minimap: { enabled: false },
                codeLens: false,
                scrollBeyondLastLine: false,
                originalEditable: false,
              }}
              onMount={(diffEditor, monaco) => {
                conflictModelsRef.current.forEach((model) => model.dispose());

                const originalModel = monaco.editor.createModel(conflictDiskContent, undefined);
                const modifiedModel = monaco.editor.createModel(getEditorValue(), undefined);
                conflictModelsRef.current = [originalModel, modifiedModel];

                diffEditor.setModel({
                  original: originalModel,
                  modified: modifiedModel,
                });
              }}
            />
          )}
        </div>
      )}

      <ModalFooter>
        <ServerCan action='files.update'>
          <Button color='yellow' onClick={onKeepEditor}>
            {t('pages.server.files.button.keepEditor', {})}
          </Button>
          <Button variant='default' onClick={onLoadDisk}>
            {t('pages.server.files.button.loadDisk', {})}
          </Button>
        </ServerCan>
      </ModalFooter>
    </Modal>
  );
}
