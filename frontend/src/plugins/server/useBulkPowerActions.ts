import { useState } from 'react';
import { z } from 'zod';
import sendPowerAction from '@/api/server/sendPowerAction.ts';
import { serverPowerAction } from '@/lib/schemas/server/server.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export function useBulkPowerActions() {
  const { t, tItem } = useTranslations();
  const { addToast } = useToast();
  const [bulkActionLoading, setBulkActionLoading] = useState<z.infer<typeof serverPowerAction> | null>(null);

  const handleBulkPowerAction = async (serverUuids: string[], action: z.infer<typeof serverPowerAction>) => {
    setBulkActionLoading(action);

    const results = await Promise.allSettled(serverUuids.map((uuid) => sendPowerAction(uuid, action)));

    const successful = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    const actionPastTenseMap: Record<
      z.infer<typeof serverPowerAction>,
      'started' | 'stopped' | 'restarted' | 'killed'
    > = {
      start: 'started',
      stop: 'stopped',
      restart: 'restarted',
      kill: 'killed',
    };
    const actionPastTense = actionPastTenseMap[action];

    if (failed === 0) {
      addToast(
        t('pages.account.home.bulkActions.success', {
          servers: tItem('server', successful),
          action: t(`common.enum.bulkActionServerAction.${actionPastTense}`, {}),
        }),
        'success',
      );
    } else {
      addToast(
        t('pages.account.home.bulkActions.partial', {
          successfulServers: tItem('server', successful),
          failedServers: tItem('server', failed),
          action: t(`common.enum.bulkActionServerAction.${actionPastTense}`, {}),
        }),
        'warning',
      );
    }

    setBulkActionLoading(null);
  };

  return { handleBulkPowerAction, bulkActionLoading };
}
