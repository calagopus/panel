import { faPencil, faTrash } from '@fortawesome/free-solid-svg-icons';
import { useState } from 'react';
import { z } from 'zod';
import Code from '@/elements/Code.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/ContextMenu.tsx';
import CopyOnClick from '@/elements/CopyOnClick.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import TableLink from '@/elements/TableLink.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { databaseAgentTypeLabelMapping } from '@/lib/enums.ts';
import { adminServerDatabaseAgentSchema } from '@/lib/schemas/admin/servers.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import DatabaseAgentHostInstanceDeleteModal from '../modals/DatabaseAgentHostInstanceDeleteModal.tsx';
import DatabaseAgentHostInstanceEditModal from '../modals/DatabaseAgentHostInstanceEditModal.tsx';

export default function DatabaseAgentRow({
  hostUuid,
  databaseAgent,
}: {
  hostUuid: string;
  databaseAgent: z.infer<typeof adminServerDatabaseAgentSchema>;
}) {
  const { t } = useTranslations();
  const [openModal, setOpenModal] = useState<'edit' | 'delete' | null>(null);
  const host = databaseAgent.host ? `${databaseAgent.host}${databaseAgent.port ? `:${databaseAgent.port}` : ''}` : null;

  return (
    <>
      <DatabaseAgentHostInstanceEditModal
        hostUuid={hostUuid}
        serverUuid={databaseAgent.server.uuid}
        instance={databaseAgent}
        opened={openModal === 'edit'}
        onClose={() => setOpenModal(null)}
      />

      <DatabaseAgentHostInstanceDeleteModal
        hostUuid={hostUuid}
        serverUuid={databaseAgent.server.uuid}
        instance={databaseAgent}
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
      />

      <ContextMenu
        items={[
          {
            type: 'action',
            icon: faPencil,
            label: t('common.button.edit', {}),
            onClick: () => setOpenModal('edit'),
            color: 'gray',
            canAccess: useAdminCan('database-agent-hosts.update'),
          },
          {
            type: 'action',
            icon: faTrash,
            label: t('common.button.delete', {}),
            onClick: () => setOpenModal('delete'),
            color: 'red',
            canAccess: useAdminCan('database-agent-hosts.delete'),
          },
        ]}
      >
        {({ items, openMenu }) => (
          <TableRow
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(e.clientX, e.clientY);
            }}
          >
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
              {databaseAgent.databaseAgentTemplate ? (
                <TableLink to={`/admin/database-agent-templates/${databaseAgent.databaseAgentTemplate.uuid}`}>
                  <Code>{databaseAgent.databaseAgentTemplate.name}</Code>
                </TableLink>
              ) : null}
            </TableData>

            <TableData>
              <FormattedTimestamp timestamp={databaseAgent.created} />
            </TableData>

            <ContextMenuToggle items={items} openMenu={openMenu} />
          </TableRow>
        )}
      </ContextMenu>
    </>
  );
}
