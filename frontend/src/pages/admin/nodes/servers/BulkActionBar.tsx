import { z } from 'zod';
import ActionBar from '@/elements/ActionBar.tsx';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import { serverPowerAction } from '@/lib/schemas/server/server.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import ServerPowerButtons from './ServerPowerButtons.tsx';

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
      <ServerPowerButtons count={selectedCount} loading={loading} onAction={onPowerAction} />
      <AdminCan action='nodes.transfers'>
        <Button color='gray' onClick={onTransfer} disabled={loading !== null}>
          {t('common.button.transfer', {})} ({selectedCount})
        </Button>
      </AdminCan>
      <Button variant='default' onClick={onClear}>
        {t('common.button.cancel', {})}
      </Button>
    </ActionBar>
  );
}
