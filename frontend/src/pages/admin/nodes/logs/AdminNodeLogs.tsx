import { useEffect, useState } from 'react';
import stripAnsi from 'strip-ansi';
import { z } from 'zod';
import { axiosInstance, httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Select from '@/elements/input/Select.tsx';
import MonacoEditor from '@/elements/MonacoEditor.tsx';
import Spinner from '@/elements/Spinner.tsx';
import { getNodeUrl } from '@/lib/node.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { bytesToString } from '@/lib/size.ts';
import { useToast } from '@/providers/ToastProvider.tsx';

interface NodeLog {
  name: string;
  size: number;
  lastModified: Date;
}

export default function AdminNodeLogs({ node }: { node: z.infer<typeof adminNodeSchema> }) {
  const { addToast } = useToast();

  const [logs, setLogs] = useState<NodeLog[]>([]);
  const [lines, setLines] = useState(1000);
  const [selectedLog, setSelectedLog] = useState<NodeLog | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    axiosInstance
      .get(getNodeUrl(node, '/api/system/logs'), {
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
    if (!selectedLog) {
      return;
    }

    setLoading(true);

    axiosInstance
      .get(getNodeUrl(node, `/api/system/logs/${selectedLog.name}`), {
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
      .get(getNodeUrl(node, `/api/system/logs/${selectedLog.name}?lines=${lines}`), {
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
    <AdminSubContentContainer title='Node Logs' titleOrder={2}>
      {!logs.length ? (
        <Spinner.Centered />
      ) : (
        <div className='flex flex-col'>
          <div className='grid md:grid-cols-4 grid-cols-2 grid-rows-1 gap-2'>
            <div className='flex flex-row space-x-2 col-span-2'>
              <Select
                withAsterisk
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
              <NumberInput
                withAsterisk
                label='Lines'
                placeholder='Lines'
                value={lines}
                className='w-full'
                onChange={(value) => setLines(Number(value))}
              />
            </div>

            <div className='flex flex-row items-end'>
              <Button onClick={doDownload} disabled={!selectedLog} loading={loading}>
                Download Full Log
              </Button>
              <Button className='ml-2' onClick={doView} variant='outline' disabled={!selectedLog} loading={loading}>
                View
              </Button>
            </div>
          </div>

          <div className='mt-4 rounded-md overflow-hidden'>
            <MonacoEditor
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
    </AdminSubContentContainer>
  );
}
