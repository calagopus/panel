import Card from '@/elements/data-display/Card.tsx';
import LogTerminal from '@/elements/data-display/LogTerminal.tsx';
import Progress from '@/elements/feedback/Progress.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function DatabaseInstanceLogs({ connected }: { connected: boolean }) {
  const { t } = useTranslations();
  const logs = useServerStore((state) => state.databaseInstanceLogs);
  const imagePulls = useServerStore((state) => state.databaseInstanceImagePulls);

  return (
    <Card className='h-[50vh] flex flex-col font-mono text-sm relative isolate p-2!'>
      {!connected && <Spinner.Centered />}

      <LogTerminal lines={logs} />

      {imagePulls.size > 0 && (
        <span className='flex flex-col justify-end mt-4'>
          {[...imagePulls.entries()].map(([id, progress]) => (
            <span key={id} className='flex flex-row w-full items-center whitespace-pre-wrap break-all'>
              {progress.status === 'pulling'
                ? t('pages.server.databases.instance.message.pulling', {})
                : t('pages.server.databases.instance.message.extracting', {})}{' '}
              <Progress
                hourglass={false}
                indeterminate={progress.bytesTotal === 0}
                value={(progress.bytesProcessed / progress.bytesTotal) * 100}
                className='flex-1 ml-2'
              />
            </span>
          ))}
        </span>
      )}
    </Card>
  );
}
