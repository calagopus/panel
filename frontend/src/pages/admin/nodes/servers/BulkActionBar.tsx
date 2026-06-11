import { z } from 'zod';
import ActionBar from '@/elements/ActionBar.tsx';
import Button from '@/elements/Button.tsx';
import { serverPowerAction } from '@/lib/schemas/server/server.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

interface BulkActionBarProps {
  selectedCount: number;
  onClear: () => void;
  onPowerAction: (action: z.infer<typeof serverPowerAction>) => void;
  onTransfer: () => void;
  loading: z.infer<typeof serverPowerAction> | null;
}

export default function BulkActionBar({
  selectedCount,
  onClear,
  onPowerAction,
  onTransfer,
  loading,
}: BulkActionBarProps) {
  const { t } = useTranslations();

  return (
    <ActionBar opened={selectedCount > 0}>
      <Button
        color='green'
        onClick={() => onPowerAction('start')}
        loading={loading === 'start'}
        disabled={loading !== null && loading !== 'start'}
      >
        {t('common.enum.serverPowerAction.start', {})} ({selectedCount})
      </Button>
      <Button
        color='gray'
        onClick={() => onPowerAction('restart')}
        loading={loading === 'restart'}
        disabled={loading !== null && loading !== 'restart'}
      >
        {t('common.enum.serverPowerAction.restart', {})} ({selectedCount})
      </Button>
      <Button
        color='red'
        onClick={() => onPowerAction('stop')}
        loading={loading === 'stop'}
        disabled={loading !== null && loading !== 'stop'}
      >
        {t('common.enum.serverPowerAction.stop', {})} ({selectedCount})
      </Button>
      <Button color='gray' onClick={onTransfer} disabled={loading !== null}>
        {t('common.button.transfer', {})} ({selectedCount})
      </Button>
      <Button variant='default' onClick={onClear}>
        {t('common.button.cancel', {})}
      </Button>
    </ActionBar>
  );
}
