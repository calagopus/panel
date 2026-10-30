import { ModalProps } from '@mantine/core';
import { resolve } from 'pathe';
import { useState } from 'react';
import { z } from 'zod';
import restoreTrashEntries from '@/api/server/files/trash/restoreTrashEntries.ts';
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
import TrashRestoreConflictModal, {
  collectRestoreConflicts,
  TrashRestoreConflict,
} from './TrashRestoreConflictModal.tsx';
import { useRestoredToast } from './useRestoredToast.ts';

type Props = ModalProps & {
  entries: z.infer<typeof serverTrashEntrySchema>[];
  onFinished: () => void;
};

export default function TrashRestoreToModal({ entries, onFinished, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const addRestoredToast = useRestoredToast(onFinished);

  const [conflicts, setConflicts] = useState<TrashRestoreConflict[] | null>(null);

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<
    z.infer<typeof serverTrashRestoreToSchema>
  >({
    initialValues: {
      destination: '/',
      names: [],
    },
    schema: serverTrashRestoreToSchema,
    opened: props.opened,
    hydrate: () => ({ destination: '/', names: entries.map((entry) => entry.name) }),
    onClose: props.onClose,
    onSubmit: async (values) => {
      const targets = entries.map((entry, i) => ({
        entry,
        path: resolve('/', values.destination, values.names[i].trim()),
      }));
      const { restored, conflicts } = await restoreTrashEntries({
        uuid: server.uuid,
        entries: targets.map(({ entry, path }) => ({ uuid: entry.uuid, path })),
      });

      addRestoredToast(restored);
      if (conflicts.length > 0) {
        setConflicts(collectRestoreConflicts(targets, conflicts));
      } else if (restored.length === 0) {
        addToast(t('pages.server.files.trash.toast.nothingRestored', {}), 'error');
      }

      onFinished();
    },
  });

  return (
    <>
      <TrashRestoreConflictModal
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
            {entries.map((entry, i) => (
              <div key={entry.uuid}>
                <TextInput
                  withAsterisk
                  label={entries.length === 1 ? t('common.form.fileName', {}) : entry.name}
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
