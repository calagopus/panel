import { Title } from '@mantine/core';
import { type OnMount } from '@monaco-editor/react';
import { join } from 'pathe';
import { useEffect, useRef, useState } from 'react';
import { createSearchParams, useNavigate, useParams, useSearchParams } from 'react-router';
import getFileContent from '@/api/server/files/getFileContent.ts';
import saveFileContent from '@/api/server/files/saveFileContent.ts';
import Button from '@/elements/Button.tsx';
import { ServerCan } from '@/elements/Can.tsx';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import MonacoEditor from '@/elements/MonacoEditor.tsx';
import Spinner from '@/elements/Spinner.tsx';
import { registerHoconLanguage, registerTomlLanguage } from '@/lib/monaco.ts';
import NotFound from '@/pages/NotFound.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import FileBreadcrumbs from './FileBreadcrumbs.tsx';
import FileNameModal from './modals/FileNameModal.tsx';

export default function FileEditor() {
  const params = useParams<'action'>();

  const [searchParams, _] = useSearchParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const { browsingBackup, browsingWritableDirectory, browsingDirectory, setBrowsingDirectory } = useServerStore();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [fileName, setFileName] = useState('');
  const [content, setContent] = useState('');

  const editorRef = useRef<Parameters<OnMount>[0]>(null);
  const contentRef = useRef(content);

  useEffect(() => {
    setBrowsingDirectory(searchParams.get('directory') || '/');
    setFileName(searchParams.get('file') || '');
  }, [searchParams]);

  useEffect(() => {
    if (!browsingDirectory || !fileName) return;
    if (params.action === 'new') return;

    setLoading(true);
    getFileContent(server.uuid, join(browsingDirectory, fileName)).then((content) => {
      setContent(content);
      setLoading(false);
    });
  }, [fileName]);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  const saveFile = (name?: string) => {
    if (!editorRef.current || browsingBackup || !browsingWritableDirectory) return;

    const currentContent = editorRef.current.getValue();
    setSaving(true);

    saveFileContent(server.uuid, join(browsingDirectory!, name ?? fileName), currentContent).then(() => {
      setSaving(false);
      setNameModalOpen(false);

      addToast(`${name ?? fileName} was saved.`);

      if (name) {
        navigate(
          `/server/${server.uuidShort}/files/edit?${createSearchParams({
            directory: browsingDirectory!,
            file: name,
          })}`,
        );
      }
    });
  };

  if (!['new', 'edit'].includes(params.action!)) {
    return <NotFound />;
  }

  return (
    <ServerContentContainer hideTitleComponent fullscreen title={`${fileName ? `Editing ${fileName}` : 'New File'}`}>
      <div className='flex justify-between items-center lg:p-4 lg:pb-0 mx-5'>
        <Title>{fileName ? `Editing ${fileName}` : 'New File'}</Title>
        <div hidden={!!browsingBackup || !browsingWritableDirectory}>
          {params.action === 'edit' ? (
            <ServerCan action='files.update'>
              <Button loading={saving} onClick={() => saveFile()}>
                Save
              </Button>
            </ServerCan>
          ) : (
            <ServerCan action='files.create'>
              <Button loading={saving} onClick={() => setNameModalOpen(true)}>
                Create
              </Button>
            </ServerCan>
          )}
        </div>
      </div>
      {loading ? (
        <div className='w-full h-screen flex items-center justify-center'>
          <Spinner size={75} />
        </div>
      ) : (
        <div className='flex flex-col relative'>
          <FileNameModal
            onFileName={(name: string) => saveFile(name)}
            opened={nameModalOpen}
            onClose={() => setNameModalOpen(false)}
          />

          <div className='flex justify-between w-full py-4'>
            <FileBreadcrumbs
              inFileEditor
              path={join(decodeURIComponent(browsingDirectory!), fileName)}
              browsingBackup={browsingBackup}
            />
          </div>
          <div className='relative'>
            <div className='flex h-[calc(100vh-185px)] lg:h-[calc(100vh-119px)] max-w-full w-full z-1 absolute'>
              <MonacoEditor
                height='100%'
                width='100%'
                theme='vs-dark'
                defaultValue={content}
                path={fileName}
                options={{
                  readOnly: !!browsingBackup || !browsingWritableDirectory,
                  stickyScroll: { enabled: false },
                  minimap: { enabled: false },
                  codeLens: false,
                  scrollBeyondLastLine: false,
                  smoothScrolling: true,
                  // @ts-expect-error this is valid
                  touchScrollEnabled: true,
                }}
                onChange={(value) => setContent(value || '')}
                onMount={(editor, monaco) => {
                  editorRef.current = editor;
                  editor.onDidChangeModelContent(() => {
                    contentRef.current = editor.getValue();
                  });
                  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
                    if (params.action === 'new') {
                      setNameModalOpen(true);
                    } else {
                      saveFile();
                    }
                  });
                  registerTomlLanguage(monaco);
                  registerHoconLanguage(monaco);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </ServerContentContainer>
  );
}
