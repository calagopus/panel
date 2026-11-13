import { Anchor } from '@mantine/core';
import { useState } from 'react';
import { z } from 'zod';
import { adminLocationSchema } from '@/lib/schemas/admin/locations.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import LocationCreateOrUpdateModal from './modals/LocationCreateOrUpdateModal.tsx';

interface LocationCreateFieldProps {
  onCreated: (location: z.infer<typeof adminLocationSchema>) => void;
}

export default function LocationCreateField({ onCreated }: LocationCreateFieldProps) {
  const { t } = useTranslations();
  const canCreateLocations = useAdminCan('locations.create');
  const [opened, setOpened] = useState(false);

  if (!canCreateLocations) {
    return null;
  }

  return (
    <>
      <LocationCreateOrUpdateModal
        opened={opened}
        onClose={() => setOpened(false)}
        onLocationCreated={onCreated}
        showNoLocationsNotice={false}
      />
      <Anchor component='button' type='button' size='sm' onClick={() => setOpened(true)}>
        {t('common.form.locationCreateHint', {})}
      </Anchor>
    </>
  );
}
