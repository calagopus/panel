import { Group, Stack, Tooltip } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import updateWebauthnSettings from '@/api/admin/settings/updateWebauthnSettings.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { isIP } from '@/lib/ip.ts';
import { adminSettingsWebauthnSchema } from '@/lib/schemas/admin/settings.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';

export default function WebauthnContainer() {
  const { addToast } = useToast();
  const { webauthn } = useAdminStore();

  const [openModal, setOpenModal] = useState<'changeRpId' | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof adminSettingsWebauthnSchema>>({
    initialValues: {
      rpId: '',
      rpOrigin: '',
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(adminSettingsWebauthnSchema),
  });

  useEffect(() => {
    form.setValues({
      ...webauthn,
    });
  }, [webauthn]);

  const doUpdate = () => {
    setLoading(true);
    updateWebauthnSettings(adminSettingsWebauthnSchema.parse(form.getValues()))
      .then(() => {
        addToast('Webauthn settings updated.', 'success');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  const doAutofill = () => {
    if (isIP(window.location.hostname)) {
      addToast('Cannot use Webauthn on an IP Address', 'error');
      return;
    }

    form.setValues({
      rpId: window.location.hostname.split('.').slice(-2).join('.'),
      rpOrigin: window.location.origin,
    });
  };

  return (
    <AdminSubContentContainer title='Webauthn Settings' titleOrder={2}>
      <ConfirmationModal
        opened={openModal === 'changeRpId'}
        onClose={() => setOpenModal(null)}
        title='Confirm Changing RP Id'
        confirm='Update'
        onConfirmed={() => {
          doUpdate();
          setOpenModal(null);
        }}
      >
        Are you sure you want to change the RP Id? Changing the RP Id will break all existing Webauthn credentials and
        require users to re-register their devices. This can have significant consequences, so please make sure you
        understand the implications before proceeding.
      </ConfirmationModal>

      <form
        onSubmit={form.onSubmit(() => (form.values.rpId !== webauthn.rpId ? setOpenModal('changeRpId') : doUpdate()))}
      >
        <Stack>
          <Group grow>
            <TextInput
              withAsterisk
              label='RP Id'
              placeholder='RP Id'
              key={form.key('rpId')}
              {...form.getInputProps('rpId')}
            />
            <TextInput
              withAsterisk
              label='RP Origin'
              placeholder='RP Origin'
              key={form.key('rpOrigin')}
              {...form.getInputProps('rpOrigin')}
            />
          </Group>
        </Stack>

        <Group mt='md'>
          <AdminCan
            action='settings.update'
            renderOnCant={
              <Tooltip label='You do not have permission to update settings.'>
                <Button disabled>Save</Button>
              </Tooltip>
            }
          >
            <Button type='submit' disabled={!form.isValid()} loading={loading}>
              Save
            </Button>
          </AdminCan>
          <Button variant='outline' onClick={doAutofill} disabled={loading}>
            Autofill
          </Button>
        </Group>
      </form>
    </AdminSubContentContainer>
  );
}
