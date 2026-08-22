import { faPlay } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQueryClient } from '@tanstack/react-query';
import { RefObject, useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import AlertError from '@/elements/alerts/AlertError.tsx';
import Button from '@/elements/Button.tsx';
import Group from '@/elements/Group.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Switch from '@/elements/input/Switch.tsx';
import MonacoEditor from '@/elements/MonacoEditor.tsx';
import Stack from '@/elements/Stack.tsx';
import Text from '@/elements/Text.tsx';
import TitleCard from '@/elements/TitleCard.tsx';
import { serverDatabaseQueryResultSchema } from '@/lib/schemas/server/databases.ts';
import { useDatabaseExplorer } from '@/providers/contexts/databaseExplorerContext.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import DatabaseResultSet from './DatabaseResultSet.tsx';

const DEFAULT_ROWS = 100;

export default function DatabaseQueryConsole({ draftRef }: { draftRef: RefObject<string> }) {
  const { t } = useTranslations();
  const { api, keys, engine } = useDatabaseExplorer();
  const queryClient = useQueryClient();

  const runRef = useRef<() => void>(() => void 0);

  const [rows, setRows] = useState(DEFAULT_ROWS);
  const [readOnly, setReadOnly] = useState(true);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<z.infer<typeof serverDatabaseQueryResultSchema>[] | null>(null);
  const [error, setError] = useState('');

  const doRun = () => {
    const query = draftRef.current.trim();
    if (!query || running) return;

    setRunning(true);
    setError('');

    api
      .query({ query, rows, readOnly })
      .then((data) => {
        setResults(data);

        queryClient.invalidateQueries({ queryKey: keys.schema });
        queryClient.invalidateQueries({ queryKey: keys.rows });
      })
      .catch((err) => {
        setResults(null);
        setError(httpErrorToHuman(err));
      })
      .finally(() => setRunning(false));
  };

  useEffect(() => {
    runRef.current = doRun;
  });

  return (
    <Stack gap='md'>
      <TitleCard
        title={t('pages.server.databases.explorer.tabs.query', {})}
        rightSection={
          <Group gap='sm' className='ml-auto'>
            <Switch
              label={t('common.readOnly', {})}
              description={t('pages.server.databases.explorer.query.form.readOnlyDescription', {})}
              checked={readOnly}
              onChange={(e) => setReadOnly(e.target.checked)}
            />
            <NumberInput
              w={110}
              min={1}
              max={1000}
              clampBehavior='strict'
              label={t('pages.server.databases.explorer.query.form.rowLimit', {})}
              value={rows}
              onChange={(value) => setRows(typeof value === 'number' ? value : DEFAULT_ROWS)}
            />
            <Button color='blue' loading={running} onClick={doRun} leftSection={<FontAwesomeIcon icon={faPlay} />}>
              {t('pages.server.databases.explorer.button.run', {})}
            </Button>
          </Group>
        }
      >
        <div className='h-[30vh] min-h-56 overflow-hidden rounded-md'>
          <MonacoEditor
            height='100%'
            width='100%'
            defaultValue=''
            language={engine === 'postgres' ? 'pgsql' : engine === 'sqlite' ? 'sql' : 'mysql'}
            options={{
              stickyScroll: { enabled: false },
              minimap: { enabled: false },
              codeLens: false,
              scrollBeyondLastLine: false,
              smoothScrolling: false,
              inertialScroll: true,
              fixedOverflowWidgets: true,
            }}
            onMount={(editor, monaco) => {
              editor.setValue(draftRef.current);
              editor.onDidChangeModelContent(() => {
                draftRef.current = editor.getValue();
              });
              editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
                runRef.current();
              });
            }}
          />
        </div>
      </TitleCard>

      {error && <AlertError error={error} setError={setError} />}

      {results === null ? (
        error ? null : (
          <Text size='sm' c='dimmed'>
            {t('pages.server.databases.explorer.query.placeholder', {})}
          </Text>
        )
      ) : (
        <Stack gap='lg'>
          {results.map((result, index) => (
            <Stack gap='xs' key={`result-${index}`}>
              {results.length > 1 && (
                <Text size='xs' c='dimmed'>
                  {t('pages.server.databases.explorer.query.statement', { index: index + 1 })}
                </Text>
              )}
              <DatabaseResultSet result={result} />
            </Stack>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
