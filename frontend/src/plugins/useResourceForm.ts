import { UseFormReturnType } from '@mantine/form';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { httpErrorToHuman } from '@/api/axios.ts';
import { QueryKey } from '@/lib/queryKeys.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

interface HasUuid {
  uuid: string;
}

interface UseResourceFormOptions<T, U extends HasUuid> {
  form: UseFormReturnType<T>;
  createFn?: () => Promise<U>;
  updateFn?: () => Promise<void>;
  deleteFn?: () => Promise<void>;
  doUpdate: boolean;
  toResetOnStay?: string[];
  basePath: string;
  resourceName: string;
}

interface UseResourceFormReturn {
  loading: boolean;
  setLoading: (loading: boolean) => void;
  doCreateOrUpdate: (stay: boolean, ...bustCacheKeys: QueryKey[]) => void;
  doDelete: () => void;
}

export const useResourceForm = <T, U extends HasUuid>(options: UseResourceFormOptions<T, U>): UseResourceFormReturn => {
  const { t } = useTranslations();
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const { form, createFn, updateFn, deleteFn, doUpdate, toResetOnStay = [], basePath, resourceName } = options;

  const [loading, setLoading] = useState(false);

  const doCreateOrUpdate = (stay: boolean, ...bustCacheKeys: QueryKey[]) => {
    setLoading(true);

    const doBustCache = () => {
      for (const queryKey of bustCacheKeys) {
        queryClient.invalidateQueries({ queryKey }).catch((e) => console.error(e));
      }
    };

    if (doUpdate && updateFn) {
      updateFn()
        .then(() => {
          addToast(t('elements.resource.tooltip.updated', { resource: resourceName }), 'success');
          doBustCache();
        })
        .catch((msg) => addToast(httpErrorToHuman(msg), 'error'))
        .finally(() => setLoading(false));
    } else if (createFn) {
      createFn()
        .then((result: U) => {
          addToast(t('elements.resource.tooltip.created', { resource: resourceName }), 'success');
          doBustCache();
          if (stay) {
            toResetOnStay.forEach((field) => form.resetField(field));
          } else if (result?.uuid) {
            navigate(`${basePath}/${result.uuid}`);
          }
        })
        .catch((msg) => addToast(httpErrorToHuman(msg), 'error'))
        .finally(() => setLoading(false));
    }
  };

  const doDelete = () => {
    if (!deleteFn) {
      return;
    }

    return deleteFn()
      .then(() => {
        addToast(t('elements.resource.tooltip.deleted', { resource: resourceName }), 'success');
        navigate(basePath);
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  return {
    loading,
    setLoading,
    doCreateOrUpdate,
    doDelete,
  };
};
