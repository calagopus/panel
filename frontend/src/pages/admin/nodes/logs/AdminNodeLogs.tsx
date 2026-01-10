import { Editor } from '@monaco-editor/react';
import { useEffect, useState } from 'react';
import stripAnsi from 'strip-ansi';
import { axiosInstance, httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Select from '@/elements/input/Select.tsx';
import Spinner from '@/elements/Spinner.tsx';
import { bytesToString } from '@/lib/size.ts';
import { useToast } from '@/providers/ToastProvider.tsx';

interface NodeLog {
  name: string;
  size: number;
  lastModified: Date;
}

export default function AdminNodeLogs({ node }: { node: Node }) {
  const { addToast } = useToast();

  const [logs, setLogs] = useState<NodeLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<NodeLog | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    axiosInstance
      .get(`${new URL(node.publicUrl ?? node.url).origin}/api/system/logs`, {
        headers: {
          Authorization: `Bearer ${node.token}`,
        },
      })
      .then(({ data }) => {
        setLogs(data.logFiles.reverse());
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  }, []);

  useEffect(() => {
    if (selectedLog) return;

    setContent(null);
  }, [selectedLog]);

  const doDownload = () => {
    if (!selectedLog) return;

    setLoading(true);

    axiosInstance
      .get(`${new URL(node.publicUrl ?? node.url).origin}/api/system/logs/${selectedLog.name}`, {
        headers: {
          Authorization: `Bearer ${node.token}`,
        },
        responseType: 'blob',
      })
      .then(({ request }) => {
        const fileURL = URL.createObjectURL(request.response);
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

    axiosInstance
      .get(`${new URL(node.publicUrl ?? node.url).origin}/api/system/logs/${selectedLog.name}`, {
        headers: {
          Authorization: `Bearer ${node.token}`,
        },
        responseType: 'text',
      })
      .then(({ data }) => {
        setContent(stripAnsi(data));
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <AdminContentContainer title='Node Logs' titleOrder={2}>
      {!logs.length ? (
        <Spinner.Centered />
      ) : (
        <div className='flex flex-col'>
          <div className='grid md:grid-cols-3 grid-cols-2 grid-rows-1 gap-2'>
            <Select
              label='Log File'
              placeholder='Log File'
              value={selectedLog?.name || ''}
              className='w-full'
              onChange={(value) => setSelectedLog(logs.find((log) => log.name === value) ?? null)}
              data={logs.map((log) => ({
                label: `${log.name} (${bytesToString(log.size)})`,
                value: log.name,
              }))}
            />

            <div className='flex flex-row items-end'>
              <Button onClick={doDownload} disabled={!selectedLog} loading={loading}>
                Download
              </Button>
              <Button className='ml-2' onClick={doView} variant='outline' disabled={!selectedLog} loading={loading}>
                View
              </Button>
            </div>
          </div>

          <div className='mt-4 rounded-md overflow-hidden'>
            <Editor
              height='65vh'
              theme='vs-dark'
              value={content || ''}
              defaultLanguage='text'
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
    </AdminContentContainer>
  );
}
