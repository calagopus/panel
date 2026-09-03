import { ModalProps } from '@mantine/core';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import installEggs from '@/api/admin/egg-repositories/eggs/installEggs.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import NestSelect from '@/elements/input/NestSelect.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { adminEggRepositoryEggSchema, adminEggRepositorySchema } from '@/lib/schemas/admin/eggRepositories.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function EggRepositoryEggInstallModal({
  eggRepository,
  eggs,
  onInstalled,
  ...props
}: ModalProps & {
  eggRepository: z.infer<typeof adminEggRepositorySchema>;
  eggs: z.infer<typeof adminEggRepositoryEggSchema>[];
  onInstalled?: () => void;
}) {
  const { t, tItem } = useTranslations();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [selectedNest, setSelectedNest] = useState<string | null>(null);

  useEffect(() => {
    if (!props.opened) {
      setSelectedNest(null);
    }
  }, [props.opened]);

  const doInstall = () => {
    if (!selectedNest || eggs.length === 0) {
      return;
    }

    setLoading(true);

    installEggs(
      eggRepository.uuid,
      eggs.map((egg) => egg.uuid),
      selectedNest,
    )
      .then((installed) => {
        addToast(
          t('pages.admin.eggRepositories.tabs.eggs.page.toast.installed', { eggs: tItem('egg', installed) }),
          'success',
        );
        onInstalled?.();
        props.onClose();
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal
      title={t('pages.admin.eggRepositories.tabs.eggs.page.modal.install.title', { eggs: tItem('egg', eggs.length) })}
      {...props}
    >
      <Stack>
        <NestSelect
          withAsterisk
          label={t('common.form.nest', {})}
          value={selectedNest}
          onChange={(uuid) => setSelectedNest(uuid)}
        />

        <ModalFooter>
          <Button onClick={doInstall} loading={loading} disabled={!selectedNest}>
            {t('pages.admin.eggRepositories.tabs.eggs.page.modal.install.button', {
              eggs: tItem('egg', eggs.length),
            })}
          </Button>
          <Button variant='default' onClick={props.onClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </Modal>
  );
}
