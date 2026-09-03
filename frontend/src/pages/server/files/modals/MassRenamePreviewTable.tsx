import { faArrowRight, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { z } from 'zod';
import Table, { TableData, TableRow } from '@/elements/data-display/Table.tsx';
import Checkbox from '@/elements/input/Checkbox.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import ScrollingText from '@/elements/ScrollingText.tsx';
import Text from '@/elements/typography/Text.tsx';
import { RenamePreviewRow, RenameStatus } from '@/lib/files/massRename.ts';
import { serverDirectoryEntrySchema } from '@/lib/schemas/server/files.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function MassRenamePreviewTable({
  files,
  rows,
  blockingStatuses,
  statusLabel,
  toggleExcluded,
}: {
  files: z.infer<typeof serverDirectoryEntrySchema>[];
  rows: RenamePreviewRow[];
  blockingStatuses: RenameStatus[];
  statusLabel: Partial<Record<RenameStatus, string>>;
  toggleExcluded: (name: string) => void;
}) {
  const { t } = useTranslations();

  return (
    <div className='max-h-72 overflow-y-auto'>
      <Table
        allowSelect={false}
        columns={[
          { name: '' },
          { name: t('pages.server.files.modal.massRename.preview.original', {}) },
          { name: '' },
          { name: t('common.form.newName', {}) },
          { name: '' },
        ]}
      >
        {files.length === 0 ? (
          <TableRow>
            <TableData colSpan={5}>
              <Text size='sm' c='dimmed' className='text-center'>
                {t('pages.server.files.modal.massRename.preview.empty', {})}
              </Text>
            </TableData>
          </TableRow>
        ) : (
          rows.map((row) => {
            const blocking = blockingStatuses.includes(row.status);

            return (
              <TableRow key={row.name} className={blocking ? 'bg-(--mantine-color-red-light)' : undefined}>
                <TableData className='w-px'>
                  <Checkbox
                    checked={row.included}
                    disabled={row.status === 'unchanged' || blocking}
                    onChange={() => toggleExcluded(row.name)}
                  />
                </TableData>
                <TableData className='max-w-xs text-(--mantine-color-dimmed)'>
                  <ScrollingText>{row.name}</ScrollingText>
                </TableData>
                <TableData className='w-px'>
                  <FontAwesomeIcon icon={faArrowRight} className='w-3 h-3 text-(--mantine-color-dimmed)' />
                </TableData>
                <TableData className={`max-w-xs ${row.status === 'unchanged' ? 'text-(--mantine-color-dimmed)' : ''}`}>
                  <ScrollingText>{row.status === 'invalidRegex' ? row.name : row.newName}</ScrollingText>
                </TableData>
                <TableData className='w-px whitespace-nowrap text-right'>
                  {blocking && statusLabel[row.status] ? (
                    <Tooltip label={statusLabel[row.status]!}>
                      <FontAwesomeIcon
                        icon={faTriangleExclamation}
                        className='w-3.5 h-3.5 text-(--mantine-color-red-text)'
                      />
                    </Tooltip>
                  ) : row.status === 'unchanged' ? (
                    <Text size='xs' c='dimmed'>
                      {statusLabel.unchanged}
                    </Text>
                  ) : null}
                </TableData>
              </TableRow>
            );
          })
        )}
      </Table>
    </div>
  );
}
