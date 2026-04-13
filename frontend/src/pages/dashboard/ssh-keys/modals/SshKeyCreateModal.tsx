import { faUpload } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ModalProps, Stack } from '@mantine/core';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { ChangeEvent, useRef, useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import createSshKey from '@/api/me/ssh-keys/createSshKey.ts';
import Button from '@/elements/Button.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useUserStore } from '@/stores/user.ts';

const schema = z.object({
  name: z.string().min(3).max(31),
  publicKey: z.string(),
});

export default function SshKeyCreateModal({ opened, onClose }: ModalProps) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { addSshKey } = useUserStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);

  const { form, onClose: handleClose } = useModalForm<z.infer<typeof schema>>(
    {
      initialValues: {
        name: '',
        publicKey: '',
      },
      validateInputOnBlur: true,
      validate: zod4Resolver(schema),
    },
    onClose,
  );

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        form.setFieldValue('publicKey', content.trim());
        if (!form.values.name) {
          form.setFieldValue('name', file.name);
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const doCreate = () => {
    setLoading(true);

    createSshKey(form.values)
      .then((key) => {
        addToast(t('pages.account.sshKeys.modal.createSshKey.toast.created', {}), 'success');

        handleClose();
        addSshKey(key);
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal title={t('pages.account.sshKeys.modal.createSshKey.title', {})} onClose={handleClose} opened={opened}>
      <Stack>
        <TextInput
          withAsterisk
          label={t('common.form.name', {})}
          placeholder={t('common.form.name', {})}
          {...form.getInputProps('name')}
        />

        <TextArea
          withAsterisk
          label={t('pages.account.sshKeys.modal.createSshKey.form.publicKey', {})}
          placeholder={t('pages.account.sshKeys.modal.createSshKey.form.publicKey', {})}
          rows={3}
          resize='none'
          {...form.getInputProps('publicKey')}
        />

        <input
          type='file'
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileUpload}
          accept='.pub,application/x-pem-file,text/plain'
        />
        <Button
          leftSection={<FontAwesomeIcon icon={faUpload} />}
          className='max-w-fit'
          onClick={() => fileInputRef.current?.click()}
        >
          {t('pages.account.sshKeys.modal.createSshKey.button.uploadKeyFile', {})}
        </Button>

        <ModalFooter>
          <Button onClick={doCreate} loading={loading} disabled={!form.isValid()}>
            {t('common.button.create', {})}
          </Button>
          <Button variant='default' onClick={handleClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </Modal>
  );
}
