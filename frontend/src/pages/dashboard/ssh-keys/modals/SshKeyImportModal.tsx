import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import importSshKeys from '@/api/me/ssh-keys/importSshKeys.ts';
import Button from '@/elements/Button.tsx';
import Select from '@/elements/input/Select.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import { sshKeyProviderLabelMapping } from '@/lib/enums.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

const schema = z.object({
  provider: z.enum(['github', 'gitlab', 'launchpad']),
  username: z.string().min(3).max(31),
});

export default function SshKeyImportModal({ ...props }: ModalProps) {
  const { t, tItem } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<z.infer<typeof schema>>({
    initialValues: {
      provider: 'github',
      username: '',
    },
    validate: zod4Resolver(schema),
    onClose: props.onClose,
    onSubmit: async (values) => {
      const keys = await importSshKeys(values);
      addToast(
        t('pages.account.sshKeys.modal.importSshKeys.toast.created', { sshKeys: tItem('sshKey', keys.length) }),
        'success',
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.user.sshKeys.all() });
    },
  });

  return (
    <FormModal
      title={t('pages.account.sshKeys.modal.importSshKeys.title', {})}
      isDirty={isDirty}
      loading={loading}
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <Stack>
        <div className='grid grid-cols-3 gap-2'>
          <Select
            withAsterisk
            label={t('pages.account.sshKeys.modal.importSshKeys.form.provider', {})}
            data={Object.entries(sshKeyProviderLabelMapping).map(([value, label]) => ({
              label,
              value,
            }))}
            {...form.getInputProps('provider')}
          />

          <TextInput
            withAsterisk
            label={t('common.form.username', {})}
            className='col-span-2'
            {...form.getInputProps('username')}
          />
        </div>

        <ModalFooter>
          <Button type='submit' loading={loading} disabled={!form.isValid()}>
            {t('common.button.import', {})}
          </Button>
          <Button variant='default' onClick={handleClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </FormModal>
  );
}
