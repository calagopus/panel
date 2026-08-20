import { ModalProps } from '@mantine/core';
import { FormEvent, useEffect, useState } from 'react';
import { z } from 'zod';
import syncEggStartup from '@/api/admin/nests/eggs/syncEggStartup.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Alert from '@/elements/Alert.tsx';
import Button from '@/elements/Button.tsx';
import Select from '@/elements/input/Select.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import { adminEggSchema } from '@/lib/schemas/admin/eggs.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function EggSyncStartupModal({
  nest,
  egg,
  hasUnsavedChanges,
  ...props
}: ModalProps & {
  nest: z.infer<typeof adminNestSchema>;
  egg: z.infer<typeof adminEggSchema>;
  hasUnsavedChanges: boolean;
}) {
  const { t, tItem } = useTranslations();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [startup, setStartup] = useState('');

  useEffect(() => {
    setStartup(egg.startupCommands['Default'] || Object.values(egg.startupCommands)[0] || '');
  }, [egg, props.opened]);

  const doSync = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    syncEggStartup(nest.uuid, egg.uuid, startup)
      .then(({ synced }) => {
        addToast(
          t('pages.admin.nests.tabs.eggs.page.tabs.general.page.toast.startupSynced', {
            servers: tItem('server', synced),
          }),
          'success',
        );
        props.onClose();
      })
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'))
      .finally(() => setLoading(false));
  };

  return (
    <FormModal
      title={t('pages.admin.nests.tabs.eggs.page.tabs.general.page.modal.syncStartup.title', {})}
      loading={loading}
      {...props}
      onSubmit={doSync}
    >
      <Stack>
        {hasUnsavedChanges && (
          <Alert color='yellow'>
            {t('pages.admin.nests.tabs.eggs.page.tabs.general.page.modal.syncStartup.alert.unsavedChanges', {})}
          </Alert>
        )}

        <Select
          withAsterisk
          label={t('common.form.startupCommand', {})}
          value={startup}
          onChange={(value) => setStartup(value ?? '')}
          data={Object.entries(egg.startupCommands).map(([key, value]) => ({
            label: key,
            value,
          }))}
        />

        <Alert color='red'>
          {t('pages.admin.nests.tabs.eggs.page.tabs.general.page.modal.syncStartup.alert.overwritesEverything', {})}
        </Alert>

        <ModalFooter>
          <Button type='submit' color='red' loading={loading} disabled={!startup || hasUnsavedChanges}>
            {t('pages.admin.nests.tabs.eggs.page.tabs.general.page.button.syncStartup', {})}
          </Button>
          <Button variant='default' onClick={props.onClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </FormModal>
  );
}
