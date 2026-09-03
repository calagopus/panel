import { ModalProps } from '@mantine/core';
import { useEffect } from 'react';
import { z } from 'zod';
import duplicateEggVariable from '@/api/admin/nests/eggs/variables/duplicateEggVariable.ts';
import Button from '@/elements/buttons/Button.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import { adminEggSchema, adminEggVariableSchema } from '@/lib/schemas/admin/eggs.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import { useModalForm } from '@/plugins/form/useModalForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function EggVariableDuplicateModal({
  contextNest,
  contextEgg,
  variable,
  onDuplicated,
  ...props
}: ModalProps & {
  contextNest: z.infer<typeof adminNestSchema>;
  contextEgg: z.infer<typeof adminEggSchema>;
  variable: z.infer<typeof adminEggVariableSchema>;
  onDuplicated: (variable: z.infer<typeof adminEggVariableSchema>) => void;
}) {
  const { t } = useTranslations();
  const { addToast } = useToast();

  const { form, handleClose, handleSubmit, loading } = useModalForm<{ name: string; envVariable: string }>({
    initialValues: { name: '', envVariable: '' },
    onClose: props.onClose,
    onSubmit: async ({ name, envVariable }) => {
      const duplicated = await duplicateEggVariable(
        contextNest.uuid,
        contextEgg.uuid,
        variable.uuid,
        name,
        envVariable,
      );
      addToast(t('pages.admin.nests.tabs.eggs.page.tabs.variables.page.toast.duplicated', {}), 'success');
      onDuplicated(duplicated);
    },
  });

  useEffect(() => {
    if (props.opened) {
      form.setValues({ name: `${variable.name} (copy)`, envVariable: variable.envVariable });
    }
  }, [variable, props.opened]);

  return (
    <FormModal
      title={t('pages.admin.nests.tabs.eggs.page.tabs.variables.page.modal.duplicate.title', {})}
      loading={loading}
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <Stack>
        <TextInput
          withAsterisk
          label={t('common.form.newName', {})}
          key={form.key('name')}
          {...form.getInputProps('name')}
        />
        <TextInput
          withAsterisk
          label={t('common.form.envVariable', {})}
          key={form.key('envVariable')}
          {...form.getInputProps('envVariable')}
          onChange={(e) => form.setFieldValue('envVariable', e.target.value.toUpperCase().replace(/-| /g, '_'))}
        />

        <ModalFooter>
          <Button
            type='submit'
            loading={loading}
            disabled={form.getValues().name.length < 1 || form.getValues().envVariable.length < 1}
          >
            {t('common.button.duplicate', {})}
          </Button>
          <Button variant='default' onClick={handleClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </FormModal>
  );
}
