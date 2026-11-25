import { useState } from 'react';
import { httpErrorToHuman } from '@/api/axios.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type ItemKey = Parameters<ReturnType<typeof useTranslations>['tItem']>[0];

interface BulkActionOptions {
  action: string;
  itemKey: ItemKey;
  /** Translated past-tense action, e.g. "deleted". */
  verb: string;
  onFinished?: () => void;
}

interface RunOptions<T> extends BulkActionOptions {
  items: T[];
  request: (item: T) => Promise<unknown>;
  skipped?: number;
}

interface RunRequestOptions extends BulkActionOptions {
  request: () => Promise<{ affected: number; skipped: number }>;
}

export function useBulkAction() {
  const { t, tItem } = useTranslations();
  const { addToast } = useToast();

  const [loading, setLoading] = useState<string | null>(null);

  const run = async <T>({ action, items, itemKey, verb, request, skipped = 0, onFinished }: RunOptions<T>) => {
    if (items.length === 0) {
      addToast(t('common.bulkActions.nothingToDo', {}), 'info');
      onFinished?.();
      return { successful: 0, failed: 0 };
    }

    setLoading(action);
    const results = await Promise.allSettled(items.map(request));
    setLoading(null);

    const successful = results.filter((result) => result.status === 'fulfilled').length;
    const failed = results.length - successful;

    if (failed > 0) {
      const firstError = results.find((result) => result.status === 'rejected');

      if (successful === 0 && firstError) {
        addToast(httpErrorToHuman(firstError.reason), 'error');
      } else {
        addToast(
          t('common.bulkActions.partial', {
            action: verb,
            successfulItems: tItem(itemKey, successful),
            failedItems: tItem(itemKey, failed),
          }),
          'warning',
        );
      }
    } else if (skipped > 0) {
      addToast(
        t('common.bulkActions.successWithSkipped', {
          action: verb,
          items: tItem(itemKey, successful),
          skippedItems: tItem(itemKey, skipped),
        }),
        'success',
      );
    } else {
      addToast(t('common.bulkActions.success', { action: verb, items: tItem(itemKey, successful) }), 'success');
    }

    onFinished?.();

    return { successful, failed };
  };

  const runRequest = async ({ action, itemKey, verb, request, onFinished }: RunRequestOptions) => {
    setLoading(action);

    let result: { affected: number; skipped: number };
    try {
      result = await request();
    } catch (msg) {
      addToast(httpErrorToHuman(msg), 'error');
      return;
    } finally {
      setLoading(null);
    }

    if (result.affected === 0) {
      addToast(t('common.bulkActions.nothingToDo', {}), 'info');
    } else if (result.skipped > 0) {
      addToast(
        t('common.bulkActions.successWithSkipped', {
          action: verb,
          items: tItem(itemKey, result.affected),
          skippedItems: tItem(itemKey, result.skipped),
        }),
        'success',
      );
    } else {
      addToast(t('common.bulkActions.success', { action: verb, items: tItem(itemKey, result.affected) }), 'success');
    }

    onFinished?.();
  };

  return { run, runRequest, loading };
}
