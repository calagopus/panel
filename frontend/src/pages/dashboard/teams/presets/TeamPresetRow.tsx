import { faClone, faPencil, faTrash } from '@fortawesome/free-solid-svg-icons';
import { forwardRef, useState } from 'react';
import { z } from 'zod';
import { TableData, TableRow, TableSelectionCell } from '@/elements/data-display/Table.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/overlays/ContextMenu.tsx';
import Text from '@/elements/typography/Text.tsx';
import { canGrantTeamPreset, canManageTeamPresets } from '@/lib/domain/teams.ts';
import { userTeamPresetSchema, userTeamSchema } from '@/lib/schemas/user/teams.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import TeamPresetDeleteModal from './modals/TeamPresetDeleteModal.tsx';
import TeamPresetDuplicateModal from './modals/TeamPresetDuplicateModal.tsx';
import TeamPresetUpdateModal from './modals/TeamPresetUpdateModal.tsx';

interface TeamPresetRowProps {
  team: z.infer<typeof userTeamSchema>;
  preset: z.infer<typeof userTeamPresetSchema>;
  isSelected?: boolean;
  onSelectionChange?: (selected: boolean, range?: boolean) => void;
}

const TeamPresetRow = forwardRef<HTMLTableRowElement, TeamPresetRowProps>(function TeamPresetRow(
  { team, preset, isSelected = false, onSelectionChange },
  ref,
) {
  const { t } = useTranslations();

  const [openModal, setOpenModal] = useState<'update' | 'duplicate' | 'delete' | null>(null);

  const canWrite = canManageTeamPresets(team) && canGrantTeamPreset(team, preset);

  return (
    <>
      <TeamPresetUpdateModal
        team={team}
        preset={preset}
        opened={openModal === 'update'}
        onClose={() => setOpenModal(null)}
      />
      <TeamPresetDuplicateModal
        team={team}
        preset={preset}
        opened={openModal === 'duplicate'}
        onClose={() => setOpenModal(null)}
      />
      <TeamPresetDeleteModal
        team={team}
        preset={preset}
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
      />

      <ContextMenu
        items={[
          {
            type: 'action',
            icon: faPencil,
            label: t('common.button.edit', {}),
            onClick: () => setOpenModal('update'),
            color: 'gray',
            canAccess: canWrite,
          },
          {
            type: 'action',
            icon: faClone,
            label: t('common.button.duplicate', {}),
            onClick: () => setOpenModal('duplicate'),
            color: 'gray',
            canAccess: canWrite,
          },
          {
            type: 'action',
            icon: faTrash,
            label: t('common.button.delete', {}),
            onClick: () => setOpenModal('delete'),
            color: 'red',
            canAccess: canWrite,
          },
        ]}
        registry={window.extensionContext.extensionRegistry.pages.dashboard.teams.view.presets.contextMenu}
        registryProps={{ team, preset }}
      >
        {({ items, openMenu }) => (
          <TableRow
            ref={ref}
            bg={isSelected ? 'var(--mantine-color-blue-light)' : undefined}
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(e.clientX, e.clientY);
            }}
          >
            {onSelectionChange !== undefined && (
              <TableSelectionCell id={preset.uuid} checked={isSelected} onChange={onSelectionChange} />
            )}

            <TableData>
              {preset.name}
              {preset.description && (
                <Text size='xs' c='dimmed'>
                  {preset.description}
                </Text>
              )}
            </TableData>

            <TableData>{preset.weight}</TableData>

            <TableData>{preset.permissions.length}</TableData>

            <TableData>{preset.ignoredFiles.length}</TableData>

            <ContextMenuToggle items={items} openMenu={openMenu} />
          </TableRow>
        )}
      </ContextMenu>
    </>
  );
});

export default TeamPresetRow;
