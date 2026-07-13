import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import getDatabaseInstanceLogs from '@/api/server/databases/instances/getDatabaseInstanceLogs.ts';
import Button from '@/elements/Button.tsx';
import Group from '@/elements/Group.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import MonacoEditor from '@/elements/MonacoEditor.tsx';
import Spinner from '@/elements/Spinner.tsx';
import Stack from '@/elements/Stack.tsx';
import Text from '@/elements/Text.tsx';
import { stripAnsi } from '@/lib/ansi.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverDatabaseInstanceSchema } from '@/lib/schemas/server/databaseInstances.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function DatabaseInstanceLogs({ instance }: { instance: z.infer<typeof serverDatabaseInstanceSchema> }) {
  const { t } = useTranslations();
  const server = useServerStore((state) => state.server);

  const [lines, setLines] = useState(100);

  const editorRef = useRef<import('monaco-editor').editor.IStandaloneCodeEditor | null>(null);

  const scrollToBottom = () => {
    const editor = editorRef.current;
    if (!editor) return;

    const lineCount = editor.getModel()?.getLineCount() ?? 0;
    editor.revealLine(lineCount, 1);
  };

  const {
    data: logs,
    error,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: queryKeys.server(server.uuid).databases.instances.logs(instance.uuid, lines),
    queryFn: () => getDatabaseInstanceLogs(server.uuid, instance.uuid, lines),
  });

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  return (
    <Stack>
      <Group align='flex-end' wrap='nowrap'>
        <NumberInput
          label={t('common.form.lines', {})}
          value={lines}
          min={1}
          max={1000}
          onChange={(value) => setLines(Number(value) || 100)}
          style={{ flexGrow: 1 }}
        />
        <Button
          onClick={() => {
            void refetch();
          }}
          loading={isFetching}
          variant='outline'
        >
          {t('common.button.loadLogs', {})}
        </Button>
      </Group>

      {isFetching && logs === undefined ? (
        <Spinner.Centered />
      ) : error ? (
        <Text>{httpErrorToHuman(error)}</Text>
      ) : (
        <div className='rounded-md overflow-hidden'>
          <MonacoEditor
            height='50vh'
            theme='vs-dark'
            value={stripAnsi(logs ?? '')}
            defaultLanguage='text'
            onMount={(editor) => {
              editorRef.current = editor;
              scrollToBottom();
            }}
            options={{
              readOnly: true,
              stickyScroll: { enabled: false },
              minimap: { enabled: false },
              codeLens: false,
              scrollBeyondLastLine: false,
              smoothScrolling: false,
              // @ts-expect-error this is valid
              touchScrollEnabled: true,
            }}
          />
        </div>
      )}
    </Stack>
  );
}
