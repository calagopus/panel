import { forwardRef } from 'react';
import { z } from 'zod';
import Badge from '@/elements/Badge.tsx';
import Code from '@/elements/Code.tsx';
import CopyOnClick from '@/elements/CopyOnClick.tsx';
import Group from '@/elements/Group.tsx';
import Checkbox from '@/elements/input/Checkbox.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import TableLink from '@/elements/TableLink.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { databaseAgentTypeLabelMapping } from '@/lib/enums.ts';
import { adminServerDatabaseAgentSchema } from '@/lib/schemas/admin/servers.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

interface DatabaseAgentRowProps {
  databaseAgent: z.infer<typeof adminServerDatabaseAgentSchema>;
  isSelected?: boolean;
  onSelectionChange?: (selected: boolean) => void;
}

const DatabaseAgentRow = forwardRef<HTMLTableRowElement, DatabaseAgentRowProps>(function DatabaseAgentRow(
  { databaseAgent, isSelected, onSelectionChange },
  ref,
) {
  const { t } = useTranslations();
  const host = databaseAgent.host ? `${databaseAgent.host}${databaseAgent.port ? `:${databaseAgent.port}` : ''}` : null;

  return (
    <TableRow
      bg={isSelected ? 'var(--mantine-color-blue-light)' : undefined}
      onClick={(e) => {
        if (e.ctrlKey || e.metaKey) {
          onSelectionChange?.(true);
          return true;
        }

        return false;
      }}
      ref={ref}
    >
      <TableData className='pl-4 relative cursor-pointer w-10 text-center'>
        <Checkbox
          id={databaseAgent.uuid}
          checked={isSelected}
          onChange={(e) => {
            onSelectionChange?.(e.target.checked);
          }}
          onClick={(e) => e.stopPropagation()}
          classNames={{ input: 'cursor-pointer!' }}
        />
      </TableData>

      <TableData>{databaseAgent.name}</TableData>

      <TableData>
        <TableLink to={`/admin/servers/${databaseAgent.server.uuid}`}>
          <Code>{databaseAgent.server.name}</Code>
        </TableLink>
      </TableData>

      <TableData>{databaseAgentTypeLabelMapping[databaseAgent.type]}</TableData>

      <TableData>
        {host ? (
          <CopyOnClick content={host}>
            <Code>{host}</Code>
          </CopyOnClick>
        ) : null}
      </TableData>

      <TableData>
        <Group gap='xs' wrap='nowrap'>
          {databaseAgent.templateVersion !== null && <Code>v{databaseAgent.templateVersion}</Code>}
          {databaseAgent.updateAvailable && (
            <Badge color='yellow'>{t('pages.admin.databaseAgentTemplates.tabs.instances.page.outdated', {})}</Badge>
          )}
        </Group>
      </TableData>

      <TableData>
        <FormattedTimestamp timestamp={databaseAgent.created} />
      </TableData>
    </TableRow>
  );
});

export default DatabaseAgentRow;
