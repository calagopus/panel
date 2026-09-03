import { ModalProps } from '@mantine/core';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import duplicateMount from '@/api/admin/mounts/duplicateMount.ts';
import TextInput from '@/elements/input/TextInput.tsx';
import ResourceDuplicateModal from '@/elements/modals/ResourceDuplicateModal.tsx';
import { adminMountSchema } from '@/lib/schemas/admin/mounts.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function MountDuplicateModal({
  mount,
  ...props
}: ModalProps & { mount: z.infer<typeof adminMountSchema> }) {
  const { t } = useTranslations();

  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');

  useEffect(() => {
    setSource(mount.source);
    setTarget(mount.target);
  }, [mount, props.opened]);

  return (
    <ResourceDuplicateModal
      {...props}
      resourceName={t('pages.admin.mounts.resourceName', {})}
      sourceName={mount.name}
      duplicate={(name) => duplicateMount(mount.uuid, name, source, target)}
      redirectTo={(duplicated) => `/admin/mounts/${duplicated.uuid}`}
      disabled={source.length < 1 || target.length < 1}
    >
      <TextInput
        withAsterisk
        label={t('common.form.source', {})}
        value={source}
        onChange={(e) => setSource(e.target.value)}
      />
      <TextInput
        withAsterisk
        label={t('common.form.target', {})}
        value={target}
        onChange={(e) => setTarget(e.target.value)}
      />
    </ResourceDuplicateModal>
  );
}
