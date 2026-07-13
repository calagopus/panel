import { ModalProps } from '@mantine/core';
import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import duplicateMount from '@/api/admin/mounts/duplicateMount.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import { adminMountSchema } from '@/lib/schemas/admin/mounts.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function MountDuplicateModal({
  mount,
  ...props
}: ModalProps & { mount: z.infer<typeof adminMountSchema> }) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');

  useEffect(() => {
    setName(`${mount.name} (copy)`);
    setSource(mount.source);
    setTarget(mount.target);
  }, [mount, props.opened]);

  const doDuplicate = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    duplicateMount(mount.uuid, name, source, target)
      .then((duplicated) => {
        addToast(t('common.toast.duplicated', { resource: t('pages.admin.mounts.resourceName', {}) }), 'success');
        props.onClose();
        navigate(`/admin/mounts/${duplicated.uuid}`);
      })
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'))
      .finally(() => setLoading(false));
  };

  return (
    <FormModal
      title={t('common.modal.duplicate.title', { resource: t('pages.admin.mounts.resourceName', {}) })}
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
          label={t('pages.admin.mounts.tabs.general.page.form.source', {})}
          value={source}
          onChange={(e) => setSource(e.target.value)}
        />
        <TextInput
          withAsterisk
          label={t('pages.admin.mounts.tabs.general.page.form.target', {})}
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        />

        <ModalFooter>
          <Button type='submit' loading={loading} disabled={name.length < 1 || source.length < 1 || target.length < 1}>
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
