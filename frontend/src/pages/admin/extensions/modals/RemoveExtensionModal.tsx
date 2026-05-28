import { ModalProps, Stack } from '@mantine/core';
import { useState } from 'react';
import { z } from 'zod';
import Button from '@/elements/Button.tsx';
import Switch from '@/elements/input/Switch.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { adminBackendExtensionSchema } from '@/lib/schemas/admin/backendExtension.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

interface Props extends ModalProps {
  extension: z.infer<typeof adminBackendExtensionSchema>;
  onRemove: (removeMigrations: boolean) => void;
}

export default function RemoveExtensionModal({ extension, onRemove, onClose, ...rest }: Props) {
  const { t } = useTranslations();
  const [removeMigrations, setRemoveMigrations] = useState(false);

  return (
    <Modal title={t('pages.admin.extensions.modal.remove.title', {})} onClose={onClose} {...rest}>
      <p>
        {t('pages.admin.extensions.modal.remove.content', {
          packageName: extension.metadataToml.packageName,
        }).md()}
      </p>

      <Stack mt='md'>
        <Switch
          label={t('pages.admin.extensions.modal.remove.form.removeMigrations', {})}
          name='remove_migrations'
          defaultChecked={removeMigrations}
          onChange={(e) => setRemoveMigrations(e.target.checked)}
        />
      </Stack>

      <ModalFooter>
        <Button color='red' onClick={() => onRemove(removeMigrations)}>
          {t('common.button.delete', {})}
        </Button>
        <Button variant='default' onClick={() => onClose()}>
          {t('common.button.close', {})}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
