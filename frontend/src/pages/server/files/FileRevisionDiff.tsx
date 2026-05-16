import { faArrowLeft, faRotateLeft } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group, Title } from '@mantine/core';
import { DiffEditor } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { basename, dirname } from 'pathe';
import { useEffect, useRef, useState } from 'react';
import { createSearchParams, useNavigate, useSearchParams } from 'react-router';
import { httpErrorToHuman } from '@/api/axios.ts';
import getFileContent from '@/api/server/files/getFileContent.ts';
import getFileRevisionContent from '@/api/server/files/getFileRevisionContent.ts';
import saveFileContent from '@/api/server/files/saveFileContent.ts';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Button from '@/elements/Button.tsx';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import Spinner from '@/elements/Spinner.tsx';
import { useCurrentWindow } from '@/providers/CurrentWindowProvider.tsx';
import { FileManagerProvider } from '@/providers/FileManagerProvider.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

function FileRevisionDiffComponent() {
  const { t } = useTranslations();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const { getParent } = useCurrentWindow();
  const [searchParams] = useSearchParams();

  const filePath = searchParams.get('file') || '';
  const revisionId = parseInt(searchParams.get('revision') || '0', 10);
  const previousRevisionId = parseInt(searchParams.get('previousRevision') || '0', 10) || null;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [originalContent, setOriginalContent] = useState('');
  const [modifiedContent, setModifiedContent] = useState('');

  const diffEditorRef = useRef<editor.IStandaloneDiffEditor | null>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!filePath || !revisionId) return;

    const fetches: [Promise<string>, Promise<string>] = previousRevisionId
      ? [getFileRevisionContent(server.uuid, previousRevisionId), getFileRevisionContent(server.uuid, revisionId)]
      : [
          getFileRevisionContent(server.uuid, revisionId),
          getFileContent(server.uuid, filePath).then((blob) => blob.text()),
        ];

    Promise.all(fetches)
      .then(([original, modified]) => {
        setOriginalContent(original);
        setModifiedContent(modified);
      })
      .catch((err) => addToast(httpErrorToHuman(err), 'error'))
      .finally(() => setLoading(false));
  }, [filePath, revisionId, previousRevisionId]);

  useEffect(() => {
    const el = editorContainerRef.current;
    if (!el || loading) return;

    const updateHeight = () => {
      const virtualWindowEl = getParent();
      const elRect = el.getBoundingClientRect();

      let bottomEdge;
      if (virtualWindowEl) {
        bottomEdge = virtualWindowEl.getBoundingClientRect().bottom;
      } else {
        bottomEdge = window.innerHeight;
      }

      const newHeight = Math.max(0, bottomEdge - elRect.top);
      el.style.height = `${newHeight}px`;

      if (diffEditorRef.current?.layout) {
        diffEditorRef.current.layout();
      }
    };

    const observer = new ResizeObserver(() => updateHeight());

    const virtualWindowEl = getParent();
    if (virtualWindowEl) {
      observer.observe(virtualWindowEl);
    } else {
      observer.observe(document.body);
    }

    updateHeight();

    return () => observer.disconnect();
  }, [loading, getParent]);

  const handleRestore = () => {
    setSaving(true);
    saveFileContent(server.uuid, filePath, originalContent)
      .then(() => {
        addToast(t('pages.server.files.drawer.revisions.restored', {}), 'success');
        navigate(
          `/server/${server.uuidShort}/files/edit?${createSearchParams({
            directory: dirname(filePath),
            file: basename(filePath),
          })}`,
        );
      })
      .catch((err) => addToast(httpErrorToHuman(err), 'error'))
      .finally(() => setSaving(false));
  };

  const title = previousRevisionId
    ? `${basename(filePath)} — Revision #${previousRevisionId} vs #${revisionId}`
    : `${basename(filePath)} — Revision #${revisionId} vs Current`;

  const originalModelPath = previousRevisionId
    ? `revision-${previousRevisionId}-${filePath}`
    : `revision-${revisionId}-${filePath}`;
  const modifiedModelPath = previousRevisionId ? `revision-${revisionId}-${filePath}` : `current-${filePath}`;

  return (
    <ServerContentContainer hideTitleComponent fullscreen title={title}>
      <div className='flex justify-between items-center lg:pt-6 px-4 lg:px-6 lg:pb-0'>
        <Group>
          <ActionIcon
            variant='subtle'
            color='gray'
            onClick={() =>
              navigate(
                `/server/${server.uuidShort}/files/edit?${createSearchParams({
                  directory: dirname(filePath),
                  file: basename(filePath),
                })}`,
                { state: { openRevisions: true } },
              )
            }
          >
            <FontAwesomeIcon icon={faArrowLeft} />
          </ActionIcon>
          <Title>{title}</Title>
        </Group>
        {!previousRevisionId && (
          <Button loading={saving} leftSection={<FontAwesomeIcon icon={faRotateLeft} />} onClick={handleRestore}>
            {t('pages.server.files.drawer.revisions.tooltip.restore', {})}
          </Button>
        )}
      </div>

      {loading ? (
        <div className='w-full h-screen flex items-center justify-center'>
          <Spinner size={75} />
        </div>
      ) : (
        <div className='flex flex-col relative'>
          <div className='relative'>
            <div ref={editorContainerRef} className='flex max-w-full w-full z-1 absolute'>
              <DiffEditor
                height='100%'
                width='100%'
                theme='vs-dark'
                original={originalContent}
                modified={modifiedContent}
                originalModelPath={originalModelPath}
                modifiedModelPath={modifiedModelPath}
                options={{
                  readOnly: true,
                  renderSideBySide: true,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  smoothScrolling: true,
                  fixedOverflowWidgets: true,
                }}
                onMount={(diffEditor) => {
                  diffEditorRef.current = diffEditor;
                }}
              />
            </div>
          </div>
        </div>
      )}
    </ServerContentContainer>
  );
}

export default function FileRevisionDiff() {
  return (
    <FileManagerProvider>
      <FileRevisionDiffComponent />
    </FileManagerProvider>
  );
}
