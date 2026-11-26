import { faDownload, faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Ref, useState } from 'react';
import getSshKeys from '@/api/me/ssh-keys/getSshKeys.ts';
import Button from '@/elements/buttons/Button.tsx';
import AccountContentContainer from '@/elements/containers/AccountContentContainer.tsx';
import Table, { tableSelectionHeader } from '@/elements/data-display/Table.tsx';
import SelectionArea from '@/elements/dnd/SelectionArea.tsx';
import Group from '@/elements/layout/Group.tsx';
import ConditionalTooltip from '@/elements/overlays/ConditionalTooltip.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useTableSelection } from '@/plugins/selection/useTableSelection.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import SshKeyCreateModal from './modals/SshKeyCreateModal.tsx';
import SshKeyImportModal from './modals/SshKeyImportModal.tsx';
import SshKeyActionBar from './SshKeyActionBar.tsx';
import SshKeyRow from './SshKeyRow.tsx';

export default function DashboardSshKeys() {
  const { t, tItem } = useTranslations();
  const settings = useGlobalStore((state) => state.settings);

  const [openModal, setOpenModal] = useState<'create' | 'import' | null>(null);

  const {
    data: sshKeys,
    loading,
    error,
    search,
    setSearch,
    setPage,
    setPerPage,
    refetch,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.user.sshKeys.all(),
    fetcher: getSshKeys,
  });

  const {
    selected: selectedSshKeys,
    toggle: toggleSshKey,
    clear: clearSelection,
    selectAll,
    allSelected,
    selectionAreaProps,
  } = useTableSelection({ items: sshKeys?.data });

  return (
    <AccountContentContainer
      title={t('pages.account.sshKeys.title', {})}
      subtitle={t('common.label.limitUsage.created', {
        current: sshKeys?.total ?? 0,
        max: settings.user.maxSshKeyCount,
      })}
      search={search}
      setSearch={setSearch}
      contentRight={
        <Group>
          <ConditionalTooltip
            enabled={(sshKeys?.total ?? 0) >= settings.user.maxSshKeyCount}
            label={t('common.tooltip.limitReached.account', { items: tItem('sshKey', settings.user.maxSshKeyCount) })}
          >
            <Button
              onClick={() => setOpenModal('import')}
              color='blue'
              leftSection={<FontAwesomeIcon icon={faDownload} />}
              disabled={(sshKeys?.total ?? 0) >= settings.user.maxSshKeyCount}
            >
              {t('common.button.import', {})}
            </Button>
          </ConditionalTooltip>
          <ConditionalTooltip
            enabled={(sshKeys?.total ?? 0) >= settings.user.maxSshKeyCount}
            label={t('common.tooltip.limitReached.account', { items: tItem('sshKey', settings.user.maxSshKeyCount) })}
          >
            <Button
              onClick={() => setOpenModal('create')}
              color='blue'
              leftSection={<FontAwesomeIcon icon={faPlus} />}
              disabled={(sshKeys?.total ?? 0) >= settings.user.maxSshKeyCount}
            >
              {t('common.button.create', {})}
            </Button>
          </ConditionalTooltip>
        </Group>
      }
      registry={window.extensionContext.extensionRegistry.pages.dashboard.sshKeys.container}
    >
      <SshKeyCreateModal opened={openModal === 'create'} onClose={() => setOpenModal(null)} />
      <SshKeyImportModal opened={openModal === 'import'} onClose={() => setOpenModal(null)} />

      <SshKeyActionBar selectedSshKeys={selectedSshKeys} clearSelection={clearSelection} onFinished={refetch} />

      <SelectionArea {...selectionAreaProps}>
        <Table
          columns={[
            tableSelectionHeader({
              checked: allSelected,
              indeterminate: selectedSshKeys.size > 0 && !allSelected,
              onChange: (checked) => (checked ? selectAll() : clearSelection()),
            }),
            t('common.table.columns.name', {}),
            t('pages.account.sshKeys.table.columns.fingerprint', {}),
            t('common.table.columns.created', {}),
            '',
          ]}
          loading={loading}
          pagination={sshKeys}
          onPageSelect={setPage}
          onPerPageSelect={setPerPage}
          error={error}
        >
          {sshKeys?.data.map((key) => (
            <SelectionArea.Selectable key={key.uuid} item={key}>
              {(innerRef: Ref<HTMLElement>) => (
                <SshKeyRow
                  sshKey={key}
                  ref={innerRef as Ref<HTMLTableRowElement>}
                  isSelected={selectedSshKeys.has(key.uuid)}
                  onSelectionChange={(selected, range) => toggleSshKey(key, selected, range)}
                />
              )}
            </SelectionArea.Selectable>
          ))}
        </Table>
      </SelectionArea>
    </AccountContentContainer>
  );
}
