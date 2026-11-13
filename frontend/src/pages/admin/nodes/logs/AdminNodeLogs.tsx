import { faFileLines } from '@fortawesome/free-solid-svg-icons';
import classNames from 'classnames';
import debounce from 'debounce';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import downloadNodeLog from '@/api/admin/nodes/system/downloadNodeLog.ts';
import getNodeLog from '@/api/admin/nodes/system/getNodeLog.ts';
import getNodeLogs, { NodeLogFile } from '@/api/admin/nodes/system/getNodeLogs.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import MonacoEditor from '@/elements/editors/MonacoEditor.tsx';
import EmptyState from '@/elements/feedback/EmptyState.tsx';
import ErrorState from '@/elements/feedback/ErrorState.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Select from '@/elements/input/Select.tsx';
import Switch from '@/elements/input/Switch.tsx';
import { downloadBlob } from '@/lib/download/download.ts';
import { type OnMount } from '@/lib/editor/monacoLoader.ts';
import { stripAnsi } from '@/lib/format/ansi.ts';
import { bytesToString } from '@/lib/format/size.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { useResource } from '@/plugins/resource/useResource.ts';
import { useWebsocket } from '@/plugins/websocket/useWebsocket.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function AdminNodeLogs({ node }: { node: z.infer<typeof adminNodeSchema> }) {
  const { t } = useTranslations();
  const { addToast } = useToast();

  const [lines, setLines] = useState(1000);
  const [selectedLog, setSelectedLog] = useState<NodeLogFile | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [following, setFollowing] = useState(false);
  const [loadVersion, setLoadVersion] = useState(0);

  const editorRef = useRef<Parameters<OnMount>[0]>(null);
  const linesRef = useRef(lines);
  const pendingLines = useRef<string[]>([]);
  const flushFrame = useRef(0);
  const loadRequest = useRef(0);

  useEffect(() => {
    if (lines >= 1) {
      linesRef.current = lines;
    }
  });

  const {
    data: logFiles,
    loading: logFilesLoading,
    error: logFilesError,
    refetch: refetchLogFiles,
  } = useResource({
    queryKey: queryKeys.admin.nodes.logs(node.uuid),
    queryFn: useCallback(() => getNodeLogs(node.uuid), [node.uuid]),
  });
  const logs = useMemo(() => (logFiles ? [...logFiles].reverse() : []), [logFiles]);

  useEffect(() => {
    loadRequest.current++;
    setContent('');
    setLoadVersion((version) => version + 1);
    setLoaded(false);
    setLoading(false);
  }, [selectedLog]);

  useEffect(() => {
    pendingLines.current = [];

    const editor = editorRef.current;
    if (!editor) return;

    editor.setValue(content);
    editor.setScrollTop(editor.getScrollHeight());
  }, [content, loadVersion]);

  useEffect(() => () => cancelAnimationFrame(flushFrame.current), []);

  const flushLines = () => {
    flushFrame.current = 0;

    const editor = editorRef.current;
    const model = editor?.getModel();
    if (!editor || !model || pendingLines.current.length === 0) return;

    const atBottom = editor.getScrollTop() + editor.getLayoutInfo().height >= editor.getScrollHeight() - 4;
    const text = pendingLines.current.join('\n');
    pendingLines.current = [];

    const lastLine = model.getLineCount();
    const lastColumn = model.getLineMaxColumn(lastLine);
    model.applyEdits([
      {
        range: { startLineNumber: lastLine, startColumn: lastColumn, endLineNumber: lastLine, endColumn: lastColumn },
        text: model.getValueLength() === 0 ? text : `\n${text}`,
      },
    ]);

    const excess = model.getLineCount() - linesRef.current;
    if (excess > 0) {
      model.applyEdits([
        { range: { startLineNumber: 1, startColumn: 1, endLineNumber: excess + 1, endColumn: 1 }, text: '' },
      ]);
    }

    if (atBottom) {
      editor.setScrollTop(editor.getScrollHeight());
    }
  };

  const appendLine = (line: string) => {
    pendingLines.current.push(line);

    if (!flushFrame.current) {
      flushFrame.current = requestAnimationFrame(flushLines);
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
        downloadBlob(blob, selectedLog.name.endsWith('.gz') ? selectedLog.name.slice(0, -3) : selectedLog.name);
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  const loadLogs = useCallback(
    (log: NodeLogFile, linesValue: number) => {
      const request = ++loadRequest.current;
      setLoading(true);

      getNodeLog(node.uuid, log.name, linesValue)
        .then((data) => {
          if (request !== loadRequest.current) return;

          setContent(stripAnsi(data));
          setLoaded(true);
          setLoadVersion((version) => version + 1);
        })
        .catch((msg) => {
          if (request !== loadRequest.current) return;

          addToast(httpErrorToHuman(msg), 'error');
        })
        .finally(() => {
          if (request === loadRequest.current) setLoading(false);
        });
    },
    [node.uuid, addToast],
  );

  const doView = () => {
    if (!selectedLog) return;

    loadLogs(selectedLog, lines);
  };

  const debouncedLoadLogs = useMemo(() => debounce(loadLogs, 500), [loadLogs]);

  useEffect(() => () => debouncedLoadLogs.clear(), [selectedLog, debouncedLoadLogs]);

  useEffect(() => {
    if (!selectedLog || !loaded || lines < 1) return;

    debouncedLoadLogs(selectedLog, lines);
  }, [lines]);

  return (
    <AdminSubContentContainer
      title={t('pages.admin.nodes.tabs.logs.page.title', {})}
      titleOrder={2}
      registry={window.extensionContext.extensionRegistry.pages.admin.nodes.view.logs.subContainer}
      registryProps={{ node }}
    >
      {!logFiles ? (
        logFilesError && !logFilesLoading ? (
          <ErrorState error={httpErrorToHuman(logFilesError)} onRetry={refetchLogFiles} />
        ) : (
          <Spinner.Centered />
        )
      ) : !logs.length ? (
        <EmptyState
          icon={faFileLines}
          title={t('pages.admin.nodes.tabs.logs.page.empty.title', {})}
          description={t('pages.admin.nodes.tabs.logs.page.empty.description', {})}
        />
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
                min={1}
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
                        connected
                          ? 'bg-(--mantine-color-green-filled) animate-pulse'
                          : 'bg-(--mantine-color-red-filled)',
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
              defaultLanguage='text'
              onMount={(editor) => {
                editorRef.current = editor;
                editor.setValue(content);
                editor.setScrollTop(editor.getScrollHeight());
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
