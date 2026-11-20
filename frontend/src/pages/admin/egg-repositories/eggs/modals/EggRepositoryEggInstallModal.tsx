import { faEgg } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ModalProps, useModalsStack } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import installEggs from '@/api/admin/egg-repositories/eggs/installEggs.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import ItemPreviewList, { ItemPreviewRow } from '@/elements/data-display/ItemPreviewList.tsx';
import NestSelect from '@/elements/input/NestSelect.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminEggRepositoryEggSchema, adminEggRepositorySchema } from '@/lib/schemas/admin/eggRepositories.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import NestCreateModal from '@/pages/admin/nests/modals/NestCreateModal.tsx';
import { NestCreateHint } from '@/pages/admin/nests/NestCreateField.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function EggRepositoryEggInstallModal({
  eggRepository,
  eggs,
  onInstalled,
  ...props
}: ModalProps & {
  eggRepository: z.infer<typeof adminEggRepositorySchema> | null;
  eggs: z.infer<typeof adminEggRepositoryEggSchema>[];
  onInstalled?: () => void;
}) {
  const { t, tItem } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const stack = useModalsStack(['install', 'nest']);

  const [loading, setLoading] = useState(false);
  const [selectedNest, setSelectedNest] = useState<string | null>(null);
  const [createdNests, setCreatedNests] = useState<z.infer<typeof adminNestSchema>[]>([]);

  useEffect(() => {
    setSelectedNest(props.opened ? (eggRepository?.defaultNest?.uuid ?? null) : null);
  }, [props.opened, eggRepository?.defaultNest?.uuid]);

  useEffect(() => {
    if (props.opened) {
      stack.open('install');
    } else {
      stack.closeAll();
    }
  }, [props.opened]);

  const doInstall = () => {
    if (!eggRepository || !selectedNest || eggs.length === 0) {
      return;
    }

    setLoading(true);

    installEggs(
      eggRepository.uuid,
      eggs.map((egg) => egg.uuid),
      selectedNest,
    )
      .then((installed) => {
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.nests.all() });
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.eggs.all() });
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.eggRepositories.eggsUnscoped() });
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
    <Modal.Stack>
      <Modal
        {...props}
        {...stack.register('install')}
        onClose={props.onClose}
        title={t('pages.admin.eggRepositories.tabs.eggs.page.modal.install.title', { eggs: tItem('egg', eggs.length) })}
      >
        <Stack>
          <ItemPreviewList
            items={eggs}
            getKey={(egg) => egg.uuid}
            renderItem={(egg) => (
              <ItemPreviewRow
                icon={<FontAwesomeIcon icon={faEgg} />}
                name={egg.exportedEgg.name}
                description={egg.exportedEgg.author}
              />
            )}
          />

          <div className='flex flex-col gap-1'>
            <NestSelect
              withAsterisk
              label={t('common.form.nest', {})}
              value={selectedNest}
              onChange={(uuid) => setSelectedNest(uuid)}
              includeItems={[...(eggRepository?.defaultNest ? [eggRepository.defaultNest] : []), ...createdNests]}
            />
            <NestCreateHint onClick={() => stack.open('nest')} />
          </div>

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

      <NestCreateModal
        {...stack.register('nest')}
        onCreated={(nest) => {
          setCreatedNests((prev) => [...prev, nest]);
          setSelectedNest(nest.uuid);
          stack.close('nest');
        }}
      />
    </Modal.Stack>
  );
}
