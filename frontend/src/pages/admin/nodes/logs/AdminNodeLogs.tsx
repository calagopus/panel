import { type OnMount } from '@monaco-editor/react';
import classNames from 'classnames';
import debounce from 'debounce';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { stripAnsi } from '@/lib/ansi.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { bytesToString } from '@/lib/size.ts';
import { useWebsocket } from '@/plugins/useWebsocket.ts';
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
  const [loadVersion, setLoadVersion] = useState(0);

  const editorRef = useRef<Parameters<OnMount>[0]>(null);
  const linesRef = useRef(lines);

  useEffect(() => {
    linesRef.current = lines;
  });

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

  const { connected } = useWebsocket({
    path: `/api/admin/nodes/${node.uuid}/system/logs/${encodeURIComponent(selectedLog?.name ?? '')}/ws`,
    params: { lines: '0' },
    enabled: following && loaded && !!selectedLog,
    onMessage: (line) => appendLine(stripAnsi(line)),
    onConnectionLost: () => addToast(t('pages.admin.nodes.tabs.logs.page.toast.connectionLost', {}), 'error'),
  });

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

  const loadLogs = useCallback(
    (log: NodeLogFile, linesValue: number) => {
      setLoading(true);

      getNodeLog(node.uuid, log.name, linesValue)
        .then((data) => {
          setContent(stripAnsi(data));
          setLoaded(true);
          setLoadVersion((version) => version + 1);
        })
        .catch((msg) => {
          addToast(httpErrorToHuman(msg), 'error');
        })
        .finally(() => setLoading(false));
    },
    [node.uuid, addToast],
  );

  useEffect(() => {
    if (loadVersion === 0) return;

    requestAnimationFrame(() => {
      const editor = editorRef.current;
      if (editor) {
        editor.setScrollTop(editor.getScrollHeight());
      }
    });
  }, [loadVersion]);

  const doView = () => {
    if (!selectedLog) return;

    loadLogs(selectedLog, lines);
  };

  const debouncedLoadLogs = useMemo(() => debounce(loadLogs, 500), [loadLogs]);

  useEffect(() => {
    if (!selectedLog || !loaded) return;

    debouncedLoadLogs(selectedLog, lines);
  }, [lines]);

  return (
    <AdminSubContentContainer
      title={t('pages.admin.nodes.tabs.logs.page.title', {})}
      titleOrder={2}
      registry={window.extensionContext.extensionRegistry.pages.admin.nodes.view.logs.subContainer}
      registryProps={{ node }}
    >
      {!logs.length ? (
        <Spinner.Centered />
      ) : (
        <div className='flex flex-col'>
          <div className='grid md:grid-cols-4 grid-cols-2 grid-rows-1 gap-2'>
            <div className='flex flex-col md:flex-row gap-2 col-span-2'>
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

            <div className='flex flex-col md:flex-row md:items-end gap-2'>
              <Button onClick={doDownload} disabled={!selectedLog} loading={loading} className='min-w-fit'>
                {t('pages.admin.nodes.tabs.logs.page.button.download', {})}
              </Button>
              <Button
                onClick={doView}
                variant='outline'
                disabled={!selectedLog}
                loading={loading}
                className='min-w-fit'
              >
                {t('common.button.loadLogs', {})}
              </Button>
              <div className='flex h-9 items-center gap-2 md:self-end'>
                <Switch
                  label={t('pages.admin.nodes.tabs.logs.page.form.follow', {})}
                  checked={following}
                  disabled={!selectedLog}
                  onChange={(e) => setFollowing(e.currentTarget.checked)}
                />
                {following && (
                  <span className='flex items-center gap-1.5 text-xs text-(--mantine-color-dimmed)'>
                    <span
                      className={classNames(
                        'rounded-full size-2',
                        connected ? 'bg-green-500 animate-pulse' : 'bg-red-500',
                      )}
                    />
                    {t(`common.enum.connectionStatus.${connected ? 'connected' : 'offline'}`, {})}
                  </span>
                )}
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
                smoothScrolling: false,
                inertialScroll: true,
              }}
            />
          </div>
        </div>
      )}
    </AdminSubContentContainer>
  );
}
