import { ModalProps } from '@mantine/core';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import joinTunnel from '@/api/server/tunnel/joinTunnel.ts';
import Button from '@/elements/buttons/Button.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import Text from '@/elements/typography/Text.tsx';
import { serverTunnelNameSchema } from '@/lib/schemas/server/tunnel.ts';
import { useModalForm } from '@/plugins/form/useModalForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

const schema = z.object({ name: z.union([z.literal(''), serverTunnelNameSchema]) });

type Props = ModalProps & {
  onJoined: () => void;
};

export default function JoinTunnelModal({ onJoined, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<z.infer<typeof schema>>({
    initialValues: { name: '' },
    validate: zod4Resolver(schema),
    onClose: props.onClose,
    onSubmit: async (values) => {
      try {
        await joinTunnel(server.uuid, { name: values.name === '' ? null : values.name });
        addToast(t('pages.server.tunnel.toast.joined', {}), 'success');
        onJoined();
        props.onClose();
      } catch (error) {
        addToast(httpErrorToHuman(error), 'error');
      }
    },
  });

  useEffect(() => {
    if (!props.opened) return;

    form.setValues({ name: '' });
    form.resetDirty({ name: '' });
  }, [props.opened]);

  return (
    <FormModal
      isDirty={isDirty}
      loading={loading}
      title={t('pages.server.tunnel.modal.join.title', {})}
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <Stack gap='md'>
        <Text c='dimmed' size='sm'>
          {t('pages.server.tunnel.modal.join.description', {})}
        </Text>

        <TextInput
          label={t('pages.server.tunnel.form.name', {})}
          description={t('pages.server.tunnel.form.nameDescription', {})}
          placeholder={t('pages.server.tunnel.form.namePlaceholder', {})}
          {...form.getInputProps('name')}
        />

        <ModalFooter>
          <Button type='submit' loading={loading} disabled={!form.isValid()}>
            {t('pages.server.tunnel.button.join', {})}
          </Button>
          <Button variant='default' onClick={handleClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </FormModal>
  );
}
