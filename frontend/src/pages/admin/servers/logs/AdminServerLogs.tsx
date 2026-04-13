import { useState } from 'react';
import stripAnsi from 'strip-ansi';
import { z } from 'zod';
import getInstallLogs from '@/api/admin/servers/logs/getInstallLogs.ts';
import getLogs from '@/api/admin/servers/logs/getLogs.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Select from '@/elements/input/Select.tsx';
import MonacoEditor from '@/elements/MonacoEditor.tsx';
import { adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { useToast } from '@/providers/ToastProvider.tsx';

export default function AdminServerLogs({ server }: { server: z.infer<typeof adminServerSchema> }) {
  const { addToast } = useToast();

  const [logType, setLogType] = useState<'console' | 'install'>('install');
  const [lines, setLines] = useState(1000);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const doView = () => {
    setLoading(true);

    (logType === 'console' ? getLogs(server.uuid, lines) : getInstallLogs(server.uuid, lines))
      .then((data) => {
        setContent(stripAnsi(data));
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <AdminSubContentContainer
      title='Server Logs'
      titleOrder={2}
      registry={window.extensionContext.extensionRegistry.pages.admin.servers.view.logs.subContainer}
      registryProps={{ server }}
    >
      <div className='flex flex-col'>
        <div className='grid md:grid-cols-3 grid-cols-2 grid-rows-1 gap-2'>
          <div className='flex flex-row space-x-2 col-span-2'>
            <Select
              withAsterisk
              label='Log Type'
              placeholder='Log Type'
              value={logType}
              className='w-full'
              onChange={(value) => setLogType(value as 'console' | 'install')}
              data={[
                { label: 'Console', value: 'console' },
                { label: 'Install', value: 'install' },
              ]}
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
            <Button className='ml-2' onClick={doView} variant='outline' loading={loading}>
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
    </AdminSubContentContainer>
  );
}
