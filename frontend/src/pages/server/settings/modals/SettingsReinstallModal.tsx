import { ModalProps } from '@mantine/core';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import installServer from '@/api/server/settings/installServer.ts';
import Button from '@/elements/Button.tsx';
import Switch from '@/elements/input/Switch.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import { serverSettingsReinstallSchema } from '@/lib/schemas/server/settings.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function SettingsReinstallModal({ opened, onClose }: ModalProps) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { server, updateServer } = useServerStore();
  const navigate = useNavigate();

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<
    z.infer<typeof serverSettingsReinstallSchema>
  >({
    initialValues: {
      truncateDirectory: false,
    },
    validate: zod4Resolver(serverSettingsReinstallSchema),
    onClose,
    onSubmit: async (values) => {
      await installServer(server.uuid, values);
      addToast(t('pages.server.settings.reinstall.modal.toast.reinstalling', {}), 'success');
      navigate(`/server/${server.uuidShort}`);
      updateServer({ status: 'installing' });
    },
  });

  return (
    <FormModal
      title={t('pages.server.settings.reinstall.modal.title', {})}
      onClose={handleClose}
      onSubmit={handleSubmit}
      isDirty={isDirty}
      loading={loading}
      opened={opened}
    >
      <Switch
        label={t('common.form.truncateDirectory', {})}
        name='truncate'
        {...form.getInputProps('truncateDirectory', { type: 'checkbox' })}
      />

      <ModalFooter>
        <Button color='red' type='submit' loading={loading} disabled={!form.isValid()}>
          {t('pages.server.settings.reinstall.modal.button', {})}
        </Button>
        <Button variant='default' onClick={handleClose}>
          {t('common.button.close', {})}
        </Button>
      </ModalFooter>
    </FormModal>
  );
}
