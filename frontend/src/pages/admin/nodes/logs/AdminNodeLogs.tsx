import { type OnMount } from '@monaco-editor/react';
import { useEffect, useRef, useState } from 'react';
import stripAnsi from 'strip-ansi';
import { z } from 'zod';
import downloadNodeLog from '@/api/admin/nodes/system/downloadNodeLog.ts';
import getNodeLog from '@/api/admin/nodes/system/getNodeLog.ts';
import getNodeLogs, { NodeLogFile } from '@/api/admin/nodes/system/getNodeLogs.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Select from '@/elements/input/Select.tsx';
import Switch from '@/elements/input/Switch.tsx';
import MonacoEditor from '@/elements/MonacoEditor.tsx';
import Spinner from '@/elements/Spinner.tsx';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { bytesToString } from '@/lib/size.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function AdminNodeLogs({ node }: { node: z.infer<typeof adminNodeSchema> }) {
  const { t } = useTranslations();
  const { addToast } = useToast();

  const [logs, setLogs] = useState<NodeLogFile[]>([]);
  const [lines, setLines] = useState(1000);
  const [selectedLog, setSelectedLog] = useState<NodeLogFile | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [following, setFollowing] = useState(false);
  const [connected, setConnected] = useState(false);

  const editorRef = useRef<Parameters<OnMount>[0]>(null);
  const linesRef = useRef(lines);
  linesRef.current = lines;

  useEffect(() => {
    getNodeLogs(node.uuid)
      .then((data) => {
        setLogs(data.reverse());
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  }, [node.uuid]);

  useEffect(() => {
    setContent(null);
    setLoaded(false);
  }, [selectedLog]);

  useEffect(() => {
    if (!following || !loaded || !selectedLog) {
      return;
    }

    let destroyed = false;

    const url = new URL(
      `/api/admin/nodes/${node.uuid}/system/logs/${encodeURIComponent(selectedLog.name)}/ws`,
      window.location.origin,
    );
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.searchParams.set('lines', '0');

    const socket = new WebSocket(url);

    socket.onopen = () => {
      if (!destroyed) {
        setConnected(true);
      }
    };

    socket.onmessage = (event) => {
      if (destroyed || typeof event.data !== 'string') {
        return;
      }

      appendLine(stripAnsi(event.data));
    };

    socket.onclose = (e) => {
      if (destroyed) {
        return;
      }

      setConnected(false);

      if (!e.wasClean) {
        addToast(t('pages.admin.nodes.tabs.logs.page.toast.connectionLost', {}), 'error');
      }
    };

    return () => {
      destroyed = true;
      setConnected(false);
      socket.close();
    };
  }, [following, loaded, selectedLog?.name, node.uuid]);

  const appendLine = (line: string) => {
    const editor = editorRef.current;

    const atBottom = editor
      ? editor.getScrollTop() + editor.getLayoutInfo().height >= editor.getScrollHeight() - 4
      : true;

    setContent((prev) => {
      const next = prev === null ? line : `${prev}\n${line}`;
      const cap = linesRef.current;

      if (cap > 0) {
        const arr = next.split('\n');
        if (arr.length > cap) {
          return arr.slice(arr.length - cap).join('\n');
        }
      }

      return next;
    });

    if (atBottom && editor) {
      requestAnimationFrame(() => {
        editor.setScrollTop(editor.getScrollHeight());
      });
    }
  };

  const doDownload = () => {
    if (!selectedLog) {
      return;
    }

    setLoading(true);

    downloadNodeLog(node.uuid, selectedLog.name, lines)
      .then((blob) => {
        const fileURL = URL.createObjectURL(blob);
        const downloadLink = document.createElement('a');
        downloadLink.href = fileURL;
        downloadLink.download = selectedLog.name.endsWith('.gz') ? selectedLog.name.slice(0, -3) : selectedLog.name;
        document.body.appendChild(downloadLink);
        downloadLink.click();

        URL.revokeObjectURL(fileURL);
        downloadLink.remove();
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  const doView = () => {
    if (!selectedLog) return;

    setLoading(true);

    getNodeLog(node.uuid, selectedLog.name, lines)
      .then((data) => {
        setContent(stripAnsi(data));
        setLoaded(true);
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <AdminSubContentContainer title={t('pages.admin.nodes.tabs.logs.page.title', {})} titleOrder={2}>
      {!logs.length ? (
        <Spinner.Centered />
      ) : (
        <div className='flex flex-col'>
          <div className='grid md:grid-cols-4 grid-cols-2 grid-rows-1 gap-2'>
            <div className='flex flex-row space-x-2 col-span-2'>
              <Select
                withAsterisk
                label={t('pages.admin.nodes.tabs.logs.page.form.logFile', {})}
                value={selectedLog?.name || ''}
                className='w-full'
                onChange={(value) => setSelectedLog(logs.find((log) => log.name === value) ?? null)}
                data={logs.map((log) => ({
                  label: `${log.name} (${bytesToString(log.size)})`,
                  value: log.name,
                }))}
              />
              <NumberInput
                withAsterisk
                label={t('common.form.lines', {})}
                value={lines}
                className='w-full'
                onChange={(value) => setLines(Number(value))}
              />
            </div>

            <div className='flex flex-row items-end gap-2'>
              <Button onClick={doDownload} disabled={!selectedLog} loading={loading} className='min-w-fit'>
                {t('pages.admin.nodes.tabs.logs.page.button.download', {})}
              </Button>
              <Button
                onClick={doView}
                variant='outline'
                disabled={!selectedLog || connected}
                loading={loading}
                className='min-w-fit'
              >
                {t('common.button.loadLogs', {})}
              </Button>
              <div className='flex h-9 items-center self-end'>
                <Switch
                  label={t('pages.admin.nodes.tabs.logs.page.form.follow', {})}
                  checked={following}
                  disabled={!selectedLog}
                  onChange={(e) => setFollowing(e.currentTarget.checked)}
                />
              </div>
            </div>
          </div>

          <div className='mt-4 rounded-md overflow-hidden'>
            <MonacoEditor
              height='65vh'
              theme='vs-dark'
              value={content || ''}
              defaultLanguage='text'
              onMount={(editor) => {
                editorRef.current = editor;
              }}
              options={{
                readOnly: true,
                stickyScroll: { enabled: false },
                minimap: { enabled: false },
                codeLens: false,
                scrollBeyondLastLine: false,
                smoothScrolling: true,
                // @ts-expect-error this is valid
                touchScrollEnabled: true,
              }}
            />
          </div>
        </div>
      )}
    </AdminSubContentContainer>
  );
}
