import { ModalProps } from '@mantine/core';
import { FormEvent, useEffect, useState } from 'react';
import { z } from 'zod';
import duplicateEggVariable from '@/api/admin/nests/eggs/variables/duplicateEggVariable.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import { adminEggSchema, adminEggVariableSchema } from '@/lib/schemas/admin/eggs.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
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

  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [envVariable, setEnvVariable] = useState('');

  useEffect(() => {
    setName(`${variable.name} (copy)`);
    setEnvVariable(variable.envVariable);
  }, [variable, props.opened]);

  const doDuplicate = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    duplicateEggVariable(contextNest.uuid, contextEgg.uuid, variable.uuid, name, envVariable)
      .then((duplicated) => {
        addToast(t('pages.admin.nests.tabs.eggs.page.tabs.variables.page.toast.duplicated', {}), 'success');
        props.onClose();
        onDuplicated(duplicated);
      })
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'))
      .finally(() => setLoading(false));
  };

  return (
    <FormModal
      title={t('pages.admin.nests.tabs.eggs.page.tabs.variables.page.modal.duplicate.title', {})}
      loading={loading}
      {...props}
      onSubmit={doDuplicate}
    >
      <Stack>
        <TextInput
          withAsterisk
          label={t('common.form.newName', {})}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <TextInput
          withAsterisk
          label={t('common.form.envVariable', {})}
          value={envVariable}
          onChange={(e) => setEnvVariable(e.target.value.toUpperCase().replace(/-| /g, '_'))}
        />

        <ModalFooter>
          <Button type='submit' loading={loading} disabled={name.length < 1 || envVariable.length < 1}>
            {t('common.button.duplicate', {})}
          </Button>
          <Button variant='default' onClick={props.onClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </FormModal>
  );
}
