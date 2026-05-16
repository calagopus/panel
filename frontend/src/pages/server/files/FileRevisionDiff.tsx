import { faArrowLeft, faRotateLeft } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group, Title } from '@mantine/core';
import type { editor } from 'monaco-editor';
import { basename, dirname } from 'pathe';
import { useEffect, useRef, useState } from 'react';
import { createSearchParams, useLocation, useNavigate, useSearchParams } from 'react-router';
import { httpErrorToHuman } from '@/api/axios.ts';
import getFileContent from '@/api/server/files/getFileContent.ts';
import getFileRevisionContent from '@/api/server/files/getFileRevisionContent.ts';
import saveFileContent from '@/api/server/files/saveFileContent.ts';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Button from '@/elements/Button.tsx';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import { MonacoDiffEditor } from '@/elements/MonacoEditor.tsx';
import Spinner from '@/elements/Spinner.tsx';
import { useCurrentWindow } from '@/providers/CurrentWindowProvider.tsx';
import { FileManagerProvider, useFileManager } from '@/providers/FileManagerProvider.tsx';
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
  const location = useLocation();
  const { editorMinimap, editorLineOverflow } = useFileManager();

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

    const passedContent: string | undefined = (location.state as { currentContent?: string } | null)?.currentContent;

    const fetches: [Promise<string>, Promise<string>] = previousRevisionId
      ? [getFileRevisionContent(server.uuid, previousRevisionId), getFileRevisionContent(server.uuid, revisionId)]
      : [
          getFileRevisionContent(server.uuid, revisionId),
          passedContent !== undefined
            ? Promise.resolve(passedContent)
            : getFileContent(server.uuid, filePath).then((blob) => blob.text()),
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

  const handleSave = () => {
    const content = diffEditorRef.current?.getModifiedEditor().getValue() ?? modifiedContent;
    setSaving(true);
    saveFileContent(server.uuid, filePath, content)
      .then(() => addToast(t('pages.server.files.toast.fileSaved', {}), 'success'))
      .catch((err) => addToast(httpErrorToHuman(err), 'error'))
      .finally(() => setSaving(false));
  };

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
    ? t('pages.server.files.titleDiffRevisionVsRevision', {
        file: basename(filePath),
        revision: String(revisionId),
        previousRevision: String(previousRevisionId),
      })
    : t('pages.server.files.titleDiffRevisionVsCurrent', {
        file: basename(filePath),
        revision: String(revisionId),
      });

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
          <Group>
            <Button
              loading={saving}
              variant='outline'
              leftSection={<FontAwesomeIcon icon={faRotateLeft} />}
              onClick={handleRestore}
            >
              {t('pages.server.files.drawer.revisions.tooltip.restore', {})}
            </Button>
            <Button loading={saving} onClick={handleSave}>
              {t('common.button.save', {})}
            </Button>
          </Group>
        )}
      </div>

      {loading ? (
        <div className='w-full h-screen flex items-center justify-center'>
          <Spinner size={75} />
        </div>
      ) : (
        <div className='flex flex-col relative mt-4'>
          <div className='relative'>
            <div ref={editorContainerRef} className='flex max-w-full w-full z-1 absolute'>
              <MonacoDiffEditor
                height='100%'
                width='100%'
                options={{
                  readOnly: !!previousRevisionId,
                  stickyScroll: { enabled: false },
                  minimap: { enabled: editorMinimap },
                  wordWrap: editorLineOverflow ? 'on' : 'off',
                  codeLens: false,
                  scrollBeyondLastLine: false,
                  smoothScrolling: true,
                  // @ts-expect-error this is valid
                  touchScrollEnabled: true,
                  fixedOverflowWidgets: true,
                }}
                onMount={(diffEditor, monaco) => {
                  diffEditorRef.current = diffEditor;

                  const originalUri = monaco.Uri.parse(originalModelPath);
                  const modifiedUri = monaco.Uri.parse(modifiedModelPath);

                  const originalModel =
                    monaco.editor.getModel(originalUri) ??
                    monaco.editor.createModel(originalContent, null, originalUri);
                  const modifiedModel =
                    monaco.editor.getModel(modifiedUri) ??
                    monaco.editor.createModel(modifiedContent, null, modifiedUri);

                  diffEditor.setModel({ original: originalModel, modified: modifiedModel });
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
