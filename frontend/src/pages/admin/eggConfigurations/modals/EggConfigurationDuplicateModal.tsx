import { ModalProps } from '@mantine/core';
import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import duplicateEggConfiguration from '@/api/admin/egg-configurations/duplicateEggConfiguration.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import { adminEggConfigurationSchema } from '@/lib/schemas/admin/eggConfigurations.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function EggConfigurationDuplicateModal({
  eggConfiguration,
  ...props
}: ModalProps & { eggConfiguration: z.infer<typeof adminEggConfigurationSchema> }) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => setName(`${eggConfiguration.name} (copy)`), [eggConfiguration, props.opened]);

  const doDuplicate = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    duplicateEggConfiguration(eggConfiguration.uuid, name)
      .then((duplicated) => {
        addToast(
          t('common.toast.duplicated', { resource: t('pages.admin.eggConfigurations.resourceName', {}) }),
          'success',
        );
        props.onClose();
        navigate(`/admin/egg-configurations/${duplicated.uuid}`);
      })
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'))
      .finally(() => setLoading(false));
  };

  return (
    <FormModal
      title={t('common.modal.duplicate.title', { resource: t('pages.admin.eggConfigurations.resourceName', {}) })}
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

        <ModalFooter>
          <Button type='submit' loading={loading} disabled={name.length < 1}>
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
