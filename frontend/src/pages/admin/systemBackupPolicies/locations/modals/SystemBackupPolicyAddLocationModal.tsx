import { ModalProps } from '@mantine/core';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import getLocations from '@/api/admin/locations/getLocations.ts';
import createSystemBackupPolicyLocation from '@/api/admin/system-backup-policies/locations/createSystemBackupPolicyLocation.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import Select from '@/elements/input/Select.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminLocationSchema } from '@/lib/schemas/admin/locations.ts';
import { adminSystemBackupPolicySchema } from '@/lib/schemas/admin/systemBackupPolicies.ts';
import { useSearchableResource } from '@/plugins/useSearchableResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function SystemBackupPolicyAddLocationModal({
  systemBackupPolicy,
  refetch,
  ...props
}: ModalProps & { systemBackupPolicy: z.infer<typeof adminSystemBackupPolicySchema>; refetch: () => void }) {
  const { addToast } = useToast();
  const { t } = useTranslations();

  const [loading, setLoading] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<z.infer<typeof adminLocationSchema> | null>(null);

  const locations = useSearchableResource<z.infer<typeof adminLocationSchema>>({
    queryKey: queryKeys.admin.locations.all(),
    fetcher: (search) => getLocations(1, search),
  });

  useEffect(() => {
    if (!props.opened) {
      locations.setSearch('');
      setSelectedLocation(null);
    }
  }, [props.opened]);

  const doAdd = () => {
    if (!selectedLocation) {
      return;
    }

    setLoading(true);

    createSystemBackupPolicyLocation(systemBackupPolicy.uuid, selectedLocation.uuid)
      .then(() => {
        addToast(t('pages.admin.systemBackupPolicies.tabs.locations.page.toast.added', {}), 'success');

        props.onClose();
        refetch();
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal title={t('pages.admin.systemBackupPolicies.tabs.locations.page.modal.add.title', {})} {...props}>
      <Stack>
        <Select
          withAsterisk
          label={t('common.form.location', {})}
          value={selectedLocation?.uuid}
          onChange={(value) => setSelectedLocation(locations.items.find((l) => l.uuid === value) ?? null)}
          data={locations.items.map((location) => ({
            label: location.name,
            value: location.uuid,
          }))}
          searchable
          searchValue={locations.search}
          onSearchChange={locations.setSearch}
          loading={locations.loading}
        />

        <ModalFooter>
          <Button onClick={doAdd} loading={loading} disabled={!selectedLocation}>
            {t('common.button.add', {})}
          </Button>
          <Button variant='default' onClick={props.onClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </Modal>
  );
}
