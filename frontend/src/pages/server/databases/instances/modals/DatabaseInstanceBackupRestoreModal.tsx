import { ModalProps } from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import restoreBackup from '@/api/server/backups/restoreBackup.ts';
import getDatabaseInstance from '@/api/server/databases/instances/getDatabaseInstance.ts';
import getDatabaseInstances from '@/api/server/databases/instances/getDatabaseInstances.ts';
import Button from '@/elements/buttons/Button.tsx';
import Select from '@/elements/input/Select.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import Text from '@/elements/typography/Text.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverBackupSchema } from '@/lib/schemas/server/backups.ts';
import { serverDatabaseInstanceSchema } from '@/lib/schemas/server/databaseInstances.ts';
import useInvalidateServerCache from '@/pages/server/hooks/useInvalidateServerCache.ts';
import { useResource } from '@/plugins/resource/useResource.ts';
import { useSearchableResource } from '@/plugins/resource/useSearchableResource.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore, useServerStoreApi } from '@/stores/server.ts';

type Props = ModalProps & {
  backup: z.infer<typeof serverBackupSchema>;
};

export default function DatabaseInstanceBackupRestoreModal({ backup, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const serverStoreApi = useServerStoreApi();
  const updateDatabaseInstance = useServerStore((state) => state.updateDatabaseInstance);
  const invalidateCacheKey = useInvalidateServerCache();

  const [loading, setLoading] = useState(false);
  const [databaseInstanceUuid, setDatabaseInstanceUuid] = useState<string | null>(backup.databaseInstanceUuid);

  const canReadInstances = useServerCan('database-instances.read');
  const instances = useSearchableResource<z.infer<typeof serverDatabaseInstanceSchema>>({
    queryKey: queryKeys.server(server.uuid).databases.instances.all(),
    fetcher: (search) => getDatabaseInstances(server.uuid, 1, search),
    canRequest: canReadInstances && props.opened,
  });
  const resource = useResource({
    queryKey: queryKeys.server(server.uuid).databases.instances.detail(databaseInstanceUuid ?? ''),
    queryFn: () => getDatabaseInstance(server.uuid, databaseInstanceUuid!),
    enabled: canReadInstances && props.opened && !!databaseInstanceUuid,
  });

  const databaseInstance =
    !resource.error && resource.data?.uuid === databaseInstanceUuid && resource.data?.type === backup.databaseType
      ? resource.data
      : null;
  const databaseInstances = useMemo(() => {
    const databaseInstances = instances.items.filter((instance) => instance.type === backup.databaseType);

    if (databaseInstance && !databaseInstances.some((instance) => instance.uuid === databaseInstance.uuid)) {
      databaseInstances.push(databaseInstance);
    }

    return databaseInstances;
  }, [instances.items, backup.databaseType, databaseInstance]);
  const canRestore = canReadInstances && !!databaseInstance && !resource.loading && !loading;

  useEffect(() => {
    if (props.opened) {
      setDatabaseInstanceUuid(backup.databaseInstanceUuid);
    }
  }, [props.opened, backup.databaseInstanceUuid]);

  const handleClose = () => {
    if (loading) {
      return;
    }

    props.onClose();
  };

  const doRestore = () => {
    if (!canRestore || !databaseInstance) {
      return;
    }

    setLoading(true);

    restoreBackup(server.uuid, backup.uuid, { databaseInstanceUuid: databaseInstance.uuid })
      .then(() => {
        if (serverStoreApi.getState().databaseInstance?.uuid === databaseInstance.uuid) {
          updateDatabaseInstance({ status: 'restoring_backup' });
        }

        invalidateCacheKey(queryKeys.server(server.uuid).databases.instances.all());

        props.onClose();
        addToast(t('pages.server.databases.instance.backups.toast.restoring', {}), 'success');
      })
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'))
      .finally(() => setLoading(false));
  };

  return (
    <Modal
      title={t('pages.server.databases.instance.backups.modal.restoreBackup.title', {})}
      {...props}
      onClose={handleClose}
    >
      <Stack>
        <Select
          withAsterisk
          label={t('pages.server.databases.instance.backups.modal.restoreBackup.targetInstance', {})}
          data={databaseInstances.map((instance) => ({ value: instance.uuid, label: instance.name }))}
          value={databaseInstanceUuid}
          searchable
          searchValue={instances.search}
          onSearchChange={instances.setSearch}
          loading={instances.loading || resource.loading}
          disabled={loading}
          onChange={setDatabaseInstanceUuid}
        />

        {databaseInstance && (
          <Text size='sm'>
            {t('pages.server.databases.instance.backups.modal.restoreBackup.content', {
              backup: backup.name,
              name: databaseInstance.name,
            }).md()}
          </Text>
        )}

        <ModalFooter>
          <Button color='red' onClick={doRestore} loading={loading} disabled={!canRestore}>
            {t('common.button.restore', {})}
          </Button>
          <Button variant='default' onClick={handleClose} disabled={loading}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </Modal>
  );
}
