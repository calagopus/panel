import { useMemo } from 'react';
import { z } from 'zod';
import TableLink from '@/elements/data-display/TableLink.tsx';
import { getBackupSourceInstance } from '@/lib/domain/server.ts';
import { databaseAgentTypeLabelMapping, serverBackupKindLabelMapping } from '@/lib/enums.ts';
import { serverBackupSchema } from '@/lib/schemas/server/backups.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

interface BackupSourceLabelProps {
  backup: Pick<z.infer<typeof serverBackupSchema>, 'kind' | 'databaseInstanceUuid' | 'databaseType' | 'metadata'>;
  to?: string;
}

export default function BackupSourceLabel({ backup, to }: BackupSourceLabelProps) {
  const { t } = useTranslations();
  const sourceInstance = useMemo(() => getBackupSourceInstance(backup), [backup]);

  if (backup.kind === 'server') {
    return (
      <span className='text-sm text-(--mantine-color-dimmed)'>
        {t('pages.server.backups.modal.createBackup.sourceFiles', {})}
      </span>
    );
  }

  const typeLabel = backup.databaseType
    ? databaseAgentTypeLabelMapping[backup.databaseType]
    : serverBackupKindLabelMapping.database_instance();

  if (!sourceInstance) {
    return <span className='text-sm text-(--mantine-color-dimmed)'>{typeLabel}</span>;
  }

  return (
    <div className='flex flex-col'>
      {to ? (
        <TableLink className='w-max max-w-full truncate font-medium' to={to}>
          {sourceInstance.name}
        </TableLink>
      ) : (
        <span className='font-medium'>
          {backup.databaseInstanceUuid
            ? sourceInstance.name
            : t('pages.server.backups.badge.sourceDeleted', { name: sourceInstance.name })}
        </span>
      )}
      <span className='text-xs text-(--mantine-color-dimmed)'>{typeLabel}</span>
    </div>
  );
}
