import { ModalProps } from '@mantine/core';
import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

interface ResourceDuplicateModalProps<T extends { uuid: string }> extends ModalProps {
  resourceName: string;
  sourceName: string;
  duplicate: (name: string) => Promise<T>;
  redirectTo: (duplicated: T) => string;
  disabled?: boolean;
  children?: ReactNode;
}

export default function ResourceDuplicateModal<T extends { uuid: string }>({
  resourceName,
  sourceName,
  duplicate,
  redirectTo,
  disabled = false,
  children,
  ...props
}: ResourceDuplicateModalProps<T>) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => setName(`${sourceName} (copy)`), [sourceName, props.opened]);

  const doDuplicate = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    duplicate(name)
      .then((duplicated) => {
        addToast(t('common.toast.duplicated', { resource: resourceName }), 'success');
        props.onClose();
        navigate(redirectTo(duplicated));
      })
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'))
      .finally(() => setLoading(false));
  };

  return (
    <FormModal
      title={t('common.modal.duplicate.title', { resource: resourceName })}
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

        {children}

        <ModalFooter>
          <Button type='submit' loading={loading} disabled={name.length < 1 || disabled}>
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
