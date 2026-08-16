import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { serverDatabaseSchemaColumnSchema, serverDatabaseSchemaTableSchema } from '@/lib/schemas/server/databases.ts';
import { useDatabaseExplorer } from '@/providers/contexts/databaseExplorerContext.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { tableIdentity } from '../DatabaseSchemaPanel.tsx';

export default function ColumnDeleteModal({
  table,
  column,
  onDeleted,
  ...props
}: ModalProps & {
  table: z.infer<typeof serverDatabaseSchemaTableSchema>;
  column: z.infer<typeof serverDatabaseSchemaColumnSchema>;
  onDeleted: () => void;
}) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { api, keys } = useDatabaseExplorer();
  const queryClient = useQueryClient();

  const doDelete = async () => {
    await api.deleteColumn({
      schema: table.schema,
      table: table.name,
      column: column.name,
    });
    await queryClient.invalidateQueries({ queryKey: keys.schema });
    queryClient.invalidateQueries({ queryKey: keys.rows });
    addToast(t('pages.server.databases.explorer.modal.deleteColumn.toast.deleted', { column: column.name }), 'success');
    props.onClose();
    onDeleted();
  };

  return (
    <ConfirmationModal
      title={t('pages.server.databases.explorer.modal.deleteColumn.title', {})}
      confirm={t('common.button.delete', {})}
      onConfirmed={doDelete}
      {...props}
    >
      {t('pages.server.databases.explorer.modal.deleteColumn.content', {
        column: column.name,
        table: tableIdentity(table),
      }).md()}
    </ConfirmationModal>
  );
}
