import { faUpload } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ModalProps } from '@mantine/core';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { ChangeEvent, useRef } from 'react';
import { z } from 'zod';
import createSshKey from '@/api/me/ssh-keys/createSshKey.ts';
import Button from '@/elements/Button.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useUserStore } from '@/stores/user.ts';

const schema = z.object({
  name: z.string().min(3).max(31),
  publicKey: z.string(),
});

export default function SshKeyCreateModal({ ...props }: ModalProps) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const addSshKey = useUserStore((state) => state.addSshKey);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<z.infer<typeof schema>>({
    initialValues: {
      name: '',
      publicKey: '',
    },
    validate: zod4Resolver(schema),
    onClose: props.onClose,
    onSubmit: async (values) => {
      const key = await createSshKey(values);
      addToast(t('pages.account.sshKeys.modal.createSshKey.toast.created', {}), 'success');
      addSshKey(key);
    },
  });

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

  return (
    <FormModal
      title={t('pages.account.sshKeys.modal.createSshKey.title', {})}
      isDirty={isDirty}
      loading={loading}
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <Stack>
        <TextInput withAsterisk label={t('common.form.name', {})} {...form.getInputProps('name')} />

        <TextArea
          withAsterisk
          label={t('pages.account.sshKeys.modal.createSshKey.form.publicKey', {})}
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
          <Button type='submit' loading={loading} disabled={!form.isValid()}>
            {t('common.button.create', {})}
          </Button>
          <Button variant='default' onClick={handleClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </FormModal>
  );
}
