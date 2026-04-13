import { ModalProps, Stack } from '@mantine/core';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import updateSecurityKey from '@/api/me/security-keys/updateSecurityKey.ts';
import Button from '@/elements/Button.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { userSecurityKeySchema } from '@/lib/schemas/user/securityKeys.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useUserStore } from '@/stores/user.ts';

const schema = z.object({
  name: z.string().min(3).max(31),
});

type Props = ModalProps & {
  securityKey: z.infer<typeof userSecurityKeySchema>;
};

export default function SecurityKeyEditModal({ securityKey, opened, onClose }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { updateSecurityKey: updateStateSecurityKey } = useUserStore();

  const [loading, setLoading] = useState(false);

  const { form, onClose: handleClose } = useModalForm<z.infer<typeof schema>>(
    {
      initialValues: {
        name: securityKey.name,
      },
      validateInputOnBlur: true,
      validate: zod4Resolver(schema),
    },
    onClose,
  );

  const doUpdate = () => {
    setLoading(true);

    updateSecurityKey(securityKey.uuid, form.values)
      .then(() => {
        updateStateSecurityKey(securityKey.uuid, form.values);

        handleClose();
        addToast(t('pages.account.securityKeys.modal.editSecurityKey.toast.updated', {}), 'success');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal
      title={t('pages.account.securityKeys.modal.editSecurityKey.title', {})}
      onClose={handleClose}
      opened={opened}
    >
      <Stack>
        <TextInput
          withAsterisk
          label={t('common.form.name', {})}
          placeholder={t('common.form.name', {})}
          {...form.getInputProps('name')}
        />

        <ModalFooter>
          <Button onClick={doUpdate} loading={loading} disabled={!form.isValid()}>
            {t('common.button.update', {})}
          </Button>
          <Button variant='default' onClick={handleClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </Modal>
  );
}
