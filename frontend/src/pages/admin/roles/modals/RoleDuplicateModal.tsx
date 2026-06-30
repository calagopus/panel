import { ModalProps } from '@mantine/core';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import duplicateRole from '@/api/admin/roles/duplicateRole.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import { roleSchema } from '@/lib/schemas/user.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function RoleDuplicateModal({
  role,
  ...props
}: Omit<ModalProps, 'role'> & { role: z.infer<typeof roleSchema> }) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => setName(`${role.name} (copy)`), [role, props.opened]);

  const doDuplicate = () => {
    setLoading(true);

    duplicateRole(role.uuid, name)
      .then((duplicated) => {
        addToast(t('common.toast.duplicated', { resource: t('pages.admin.roles.resourceName', {}) }), 'success');
        props.onClose();
        navigate(`/admin/roles/${duplicated.uuid}`);
      })
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'))
      .finally(() => setLoading(false));
  };

  return (
    <Modal title={t('common.modal.duplicate.title', { resource: t('pages.admin.roles.resourceName', {}) })} {...props}>
      <Stack>
        <TextInput
          withAsterisk
          label={t('common.form.newName', {})}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <ModalFooter>
          <Button onClick={doDuplicate} loading={loading} disabled={name.length < 1}>
            {t('common.button.duplicate', {})}
          </Button>
          <Button variant='default' onClick={props.onClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </Modal>
  );
}
