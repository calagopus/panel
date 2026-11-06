import { ModalProps } from '@mantine/core';
import { resolve } from 'pathe';
import { useState } from 'react';
import { z } from 'zod';
import restoreTrashEntryItems from '@/api/server/files/trash/restoreTrashEntryItems.ts';
import Button from '@/elements/buttons/Button.tsx';
import ServerFileInput from '@/elements/input/ServerFileInput.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import { serverTrashEntrySchema, serverTrashRestoreToSchema } from '@/lib/schemas/server/files.ts';
import FilePathPreview from '@/pages/server/files/modals/FilePathPreview.tsx';
import { useModalForm } from '@/plugins/form/useModalForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import { useTrashItemRestoredToast } from '../useRestoredToast.ts';
import TrashItemRestoreConflictModal from './TrashItemRestoreConflictModal.tsx';
import { collectItemConflicts, TrashItemConflict, TrashItemTarget } from './trashItems.ts';

type Props = ModalProps & {
  entry: z.infer<typeof serverTrashEntrySchema>;
  targets: TrashItemTarget[];
  onFinished: () => void;
};

export default function TrashItemRestoreToModal({ entry, targets, onFinished, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const addRestoredToast = useTrashItemRestoredToast(entry.uuid, onFinished);

  const [conflicts, setConflicts] = useState<TrashItemConflict[] | null>(null);

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<
    z.infer<typeof serverTrashRestoreToSchema>
  >({
    initialValues: {
      destination: '/',
      names: [],
    },
    schema: serverTrashRestoreToSchema,
    opened: props.opened,
    hydrate: () => ({ destination: '/', names: targets.map((target) => target.item.name) }),
    onClose: props.onClose,
    onSubmit: async (values) => {
      const destinations = targets.map((target, i) => ({
        ...target,
        destination: resolve('/', values.destination, values.names[i].trim()),
      }));
      const { restored, conflicts } = await restoreTrashEntryItems({
        uuid: server.uuid,
        entry: entry.uuid,
        files: destinations.map(({ path, destination }) => ({ from: path, to: destination })),
      });

      addRestoredToast(restored);
      if (conflicts.length > 0) {
        setConflicts(collectItemConflicts(entry, destinations, conflicts));
      } else if (restored.length === 0) {
        addToast(t('pages.server.files.trash.toast.nothingRestored', {}), 'error');
      }

      onFinished();
    },
  });

  return (
    <>
      <TrashItemRestoreConflictModal
        entry={entry}
        opened={conflicts !== null}
        onClose={() => setConflicts(null)}
        conflicts={conflicts ?? []}
        onResolved={(remaining) => {
          setConflicts(remaining.length > 0 ? remaining : null);
          onFinished();
        }}
        onUndone={onFinished}
      />

      <FormModal
        title={t('pages.server.files.trash.modal.restoreTo.title', {})}
        isDirty={isDirty}
        loading={loading}
        {...props}
        onClose={handleClose}
        onSubmit={handleSubmit}
      >
        <ServerFileInput
          withAsterisk
          serverUuid={server.uuid}
          mode='directory'
          label={t('pages.server.files.trash.modal.restoreTo.destination', {})}
          value={form.values.destination}
          onChange={(value) => form.setFieldValue('destination', value)}
          error={form.errors.destination}
          data-autofocus
        />

        <div className='mt-2 max-h-[40vh] min-h-0 overflow-y-auto'>
          <Stack gap='sm'>
            {targets.map((target, i) => (
              <div key={target.path}>
                <TextInput
                  withAsterisk
                  label={targets.length === 1 ? t('common.form.fileName', {}) : target.item.name}
                  {...form.getInputProps(`names.${i}`)}
                />
                <FilePathPreview
                  label={t('pages.server.files.trash.modal.restoreTo.restoredAs', {})}
                  path={resolve('/', form.values.destination, form.values.names[i] ?? '')}
                />
              </div>
            ))}
          </Stack>
        </div>

        <ModalFooter>
          <Button type='submit' loading={loading} disabled={!form.isValid()}>
            {t('common.button.restore', {})}
          </Button>
          <Button variant='default' onClick={handleClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </FormModal>
    </>
  );
}
