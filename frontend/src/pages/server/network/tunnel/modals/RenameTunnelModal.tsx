import { ModalProps } from '@mantine/core';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import renameTunnel from '@/api/server/tunnel/renameTunnel.ts';
import Button from '@/elements/buttons/Button.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import { serverTunnelRenameSchema } from '@/lib/schemas/server/tunnel.ts';
import { useModalForm } from '@/plugins/form/useModalForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

type Props = ModalProps & {
  name: string;
  alias: string;
  onRenamed: () => void;
};

export default function RenameTunnelModal({ name, alias, onRenamed, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<z.infer<typeof serverTunnelRenameSchema>>({
    initialValues: { name },
    validate: zod4Resolver(serverTunnelRenameSchema),
    onClose: props.onClose,
    onSubmit: async (values) => {
      try {
        await renameTunnel(server.uuid, values);
        addToast(t('pages.server.tunnel.toast.renamed', {}), 'success');
        onRenamed();
        props.onClose();
      } catch (error) {
        addToast(httpErrorToHuman(error), 'error');
      }
    },
  });

  useEffect(() => {
    if (!props.opened) return;

    form.setValues({ name });
    form.resetDirty({ name });
  }, [props.opened]);

  return (
    <FormModal
      isDirty={isDirty}
      loading={loading}
      title={t('pages.server.tunnel.modal.rename.title', {})}
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <Stack gap='md'>
        <Alert color='yellow'>{t('pages.server.tunnel.modal.rename.warning', { alias }).md()}</Alert>

        <TextInput
          withAsterisk
          label={t('pages.server.tunnel.form.name', {})}
          description={t('pages.server.tunnel.form.nameDescription', {})}
          {...form.getInputProps('name')}
        />

        <ModalFooter>
          <Button type='submit' loading={loading} disabled={!form.isValid()}>
            {t('common.button.update', {})}
          </Button>
          <Button variant='default' onClick={handleClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </FormModal>
  );
}
