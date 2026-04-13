import { ModalProps } from '@mantine/core';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import installServer from '@/api/server/settings/installServer.ts';
import Button from '@/elements/Button.tsx';
import Switch from '@/elements/input/Switch.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
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

  const [loading, setLoading] = useState(false);

  const { form, onClose: handleClose } = useModalForm<z.infer<typeof serverSettingsReinstallSchema>>(
    {
      initialValues: {
        truncateDirectory: false,
      },
      validateInputOnBlur: true,
      validate: zod4Resolver(serverSettingsReinstallSchema),
    },
    onClose,
  );

  const doReinstall = () => {
    setLoading(true);

    installServer(server.uuid, form.values)
      .then(() => {
        addToast(t('pages.server.settings.reinstall.modal.toast.reinstalling', {}), 'success');

        navigate(`/server/${server.uuidShort}`);
        updateServer({ status: 'installing' });
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal title={t('pages.server.settings.reinstall.modal.title', {})} onClose={handleClose} opened={opened}>
      <form onSubmit={form.onSubmit(() => doReinstall())}>
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
      </form>
    </Modal>
  );
}
