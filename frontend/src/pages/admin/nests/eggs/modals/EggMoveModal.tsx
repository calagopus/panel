import { ModalProps } from '@mantine/core';
import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import moveEgg from '@/api/admin/nests/eggs/moveEgg.ts';
import moveEggs from '@/api/admin/nests/eggs/moveEggs.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import NestSelect from '@/elements/input/NestSelect.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import { adminEggSchema } from '@/lib/schemas/admin/eggs.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function EggMoveModal({
  nest,
  eggs,
  onMoved,
  ...props
}: ModalProps & {
  nest: z.infer<typeof adminNestSchema>;
  eggs: z.infer<typeof adminEggSchema>[];
  onMoved?: () => void;
}) {
  const { addToast } = useToast();
  const { t, tItem } = useTranslations();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [selectedNest, setSelectedNest] = useState<string | null>(null);

  const isBulk = eggs.length !== 1;

  const doMove = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedNest) return;

    setLoading(true);

    const request = isBulk
      ? moveEggs(
          nest.uuid,
          eggs.map((egg) => egg.uuid),
          selectedNest,
        ).then(({ moved }) => {
          addToast(t('pages.admin.nests.tabs.eggs.page.toast.movedBulk', { eggs: tItem('egg', moved) }), 'success');
        })
      : moveEgg(nest.uuid, eggs[0].uuid, selectedNest).then(() => {
          addToast(t('pages.admin.nests.tabs.eggs.page.toast.moved', {}), 'success');
          navigate(`/admin/nests/${selectedNest}/eggs/${eggs[0].uuid}`);
        });

    request
      .then(() => {
        onMoved?.();
        props.onClose();
      })
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'))
      .finally(() => setLoading(false));
  };

  return (
    <FormModal
      title={t(
        isBulk
          ? 'pages.admin.nests.tabs.eggs.page.modal.moveBulk.title'
          : 'pages.admin.nests.tabs.eggs.page.modal.move.title',
        {},
      )}
      loading={loading}
      {...props}
      onSubmit={doMove}
    >
      <Stack>
        <NestSelect
          withAsterisk
          label={t('common.form.nest', {})}
          value={selectedNest}
          onChange={(uuid) => setSelectedNest(uuid)}
        />

        <ModalFooter>
          <Button type='submit' loading={loading} disabled={!selectedNest}>
            {isBulk
              ? t('pages.admin.nests.tabs.eggs.page.modal.moveBulk.confirm', { eggs: tItem('egg', eggs.length) })
              : t('common.button.move', {})}
          </Button>
          <Button variant='default' onClick={props.onClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </FormModal>
  );
}
