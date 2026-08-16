import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { serverDatabaseSchemaTableSchema } from '@/lib/schemas/server/databases.ts';
import { useDatabaseExplorer } from '@/providers/contexts/databaseExplorerContext.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { tableIdentity } from '../DatabaseSchemaPanel.tsx';

export default function TableDeleteModal({
  table,
  onDeleted,
  ...props
}: ModalProps & {
  table: z.infer<typeof serverDatabaseSchemaTableSchema>;
  onDeleted: () => void;
}) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { api, keys } = useDatabaseExplorer();
  const queryClient = useQueryClient();

  const doDelete = async () => {
    await api.deleteTable({ schema: table.schema, table: table.name });
    await queryClient.invalidateQueries({ queryKey: keys.schema });
    addToast(
      t('pages.server.databases.explorer.modal.deleteTable.toast.deleted', { table: tableIdentity(table) }),
      'success',
    );
    props.onClose();
    onDeleted();
  };

  return (
    <ConfirmationModal
      title={t('pages.server.databases.explorer.modal.deleteTable.title', {})}
      confirm={t('common.button.delete', {})}
      onConfirmed={doDelete}
      {...props}
    >
      {t('pages.server.databases.explorer.modal.deleteTable.content', { table: tableIdentity(table) }).md()}
    </ConfirmationModal>
  );
}
