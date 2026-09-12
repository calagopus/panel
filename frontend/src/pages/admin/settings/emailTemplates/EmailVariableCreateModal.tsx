import { ModalProps } from '@mantine/core';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import createEmailVariable from '@/api/admin/settings/email-templates/variables/createEmailVariable.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import { adminSettingsEmailVariableCreateSchema } from '@/lib/schemas/admin/settings.ts';
import { useModalForm } from '@/plugins/form/useModalForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function EmailVariableCreateModal({
  templateIdentifier,
  onCreated,
  ...props
}: ModalProps & { templateIdentifier: string | null; onCreated: () => void }) {
  const { t } = useTranslations();
  const { addToast } = useToast();

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<
    z.infer<typeof adminSettingsEmailVariableCreateSchema>
  >({
    initialValues: { name: '', value: '', valueTranslations: {} },
    validate: zod4Resolver(adminSettingsEmailVariableCreateSchema),
    opened: props.opened,
    onClose: props.onClose,
    onSubmit: async (values) => {
      await createEmailVariable(templateIdentifier, adminSettingsEmailVariableCreateSchema.parse(values));
      addToast(t('pages.admin.settings.tabs.mailTemplates.page.variables.toast.created', {}), 'success');
      onCreated();
    },
  });

  return (
    <FormModal
      title={t('pages.admin.settings.tabs.mailTemplates.page.variables.modal.create.title', {})}
      isDirty={isDirty}
      loading={loading}
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <Stack>
        <TextInput
          withAsterisk
          label={t('common.form.name', {})}
          description={t('pages.admin.settings.tabs.mailTemplates.page.variables.modal.create.nameDescription', {})}
          placeholder='footer_signature'
          key={form.key('name')}
          {...form.getInputProps('name')}
        />
        <TextArea
          withAsterisk
          label={t('common.form.value', {})}
          description={t('pages.admin.settings.tabs.mailTemplates.page.variables.modal.create.valueDescription', {})}
          autosize
          minRows={2}
          key={form.key('value')}
          {...form.getInputProps('value')}
        />
      </Stack>

      <ModalFooter>
        <AdminCan action={['settings.read', 'email-templates.update']} cantSave>
          <Button type='submit' loading={loading} disabled={!form.isValid()}>
            {t('common.button.create', {})}
          </Button>
        </AdminCan>
        <Button variant='default' onClick={handleClose}>
          {t('common.button.close', {})}
        </Button>
      </ModalFooter>
    </FormModal>
  );
}
