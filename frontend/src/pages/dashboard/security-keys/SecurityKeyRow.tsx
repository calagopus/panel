import { faPencil, faTrash } from '@fortawesome/free-solid-svg-icons';
import { useState } from 'react';
import { z } from 'zod';
import Code from '@/elements/Code.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/ContextMenu.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { userSecurityKeySchema } from '@/lib/schemas/user/securityKeys.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import SecurityKeyDeleteModal from './modals/SecurityKeyDeleteModal.tsx';
import SecurityKeyEditModal from './modals/SecurityKeyEditModal.tsx';

export default function SecurityKeyRow({ securityKey }: { securityKey: z.infer<typeof userSecurityKeySchema> }) {
  const { t } = useTranslations();

  const [openModal, setOpenModal] = useState<'edit' | 'delete' | null>(null);

  return (
    <>
      <SecurityKeyEditModal
        securityKey={securityKey}
        opened={openModal === 'edit'}
        onClose={() => setOpenModal(null)}
      />

      <SecurityKeyDeleteModal
        securityKey={securityKey}
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
      />

      <ContextMenu
        items={[
          {
            icon: faPencil,
            label: t('common.button.edit', {}),
            onClick: () => setOpenModal('edit'),
            color: 'gray',
          },
          {
            icon: faTrash,
            label: t('common.button.delete', {}),
            onClick: () => setOpenModal('delete'),
            color: 'red',
          },
        ]}
        registry={window.extensionContext.extensionRegistry.pages.dashboard.securityKeys.securityKeyContextMenu}
        registryProps={{ securityKey }}
      >
        {({ items, openMenu }) => (
          <TableRow
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(e.clientX, e.clientY);
            }}
          >
            <TableData>{securityKey.name}</TableData>

            <TableData>
              <Code>{securityKey.credentialId}</Code>
            </TableData>

            <TableData>
              {!securityKey.lastUsed ? t('common.na', {}) : <FormattedTimestamp timestamp={securityKey.lastUsed} />}
            </TableData>

            <TableData>
              <FormattedTimestamp timestamp={securityKey.created} />
            </TableData>

            <ContextMenuToggle items={items} openMenu={openMenu} />
          </TableRow>
        )}
      </ContextMenu>
    </>
  );
}
