import { faArrowsRotate, faDatabase } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Ref, useState } from 'react';
import { z } from 'zod';
import getDatabaseAgentTemplateInstances from '@/api/admin/database-agent-templates/getDatabaseAgentTemplateInstances.ts';
import updateDatabaseAgentTemplateInstances from '@/api/admin/database-agent-templates/updateDatabaseAgentTemplateInstances.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import ActionBar from '@/elements/ActionBar.tsx';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import ItemPreviewList, { ItemPreviewRow } from '@/elements/data-display/ItemPreviewList.tsx';
import Table, { tableSelectionHeader } from '@/elements/data-display/Table.tsx';
import SelectionArea from '@/elements/dnd/SelectionArea.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { databaseAgentTypeLabelMapping } from '@/lib/enums.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminDatabaseAgentTemplateSchema } from '@/lib/schemas/admin/databaseAgentTemplates.ts';
import { databaseAgentTemplateInstanceTableColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useTableSelection } from '@/plugins/selection/useTableSelection.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import DatabaseAgentTemplateInstanceRow from './DatabaseAgentTemplateInstanceRow.tsx';

type ApplyScope = 'selected' | 'all';

export default function AdminDatabaseAgentTemplateInstances({
  databaseAgentTemplate,
}: {
  databaseAgentTemplate: z.infer<typeof adminDatabaseAgentTemplateSchema>;
}) {
  const { t, tItem } = useTranslations();
  const { addToast } = useToast();

  const [pendingScope, setPendingScope] = useState<ApplyScope | null>(null);
  const [applying, setApplying] = useState<ApplyScope | null>(null);

  const {
    data: instances,
    loading,
    error,
    search,
    setSearch,
    setPage,
    setPerPage,
    refetch,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.databaseInstances.byTemplate(databaseAgentTemplate.uuid),
    fetcher: (page, search, perPage) =>
      getDatabaseAgentTemplateInstances(databaseAgentTemplate.uuid, page, search, perPage),
  });

  const { selected, toggle, clear, selectAll, allSelected, selectionAreaProps } = useTableSelection({
    items: instances?.data,
  });

  const doApplyUpdates = async () => {
    const scope = pendingScope;
    setPendingScope(null);
    if (!scope) return;

    setApplying(scope);

    await updateDatabaseAgentTemplateInstances(
      databaseAgentTemplate.uuid,
      scope === 'all' ? { type: 'outdated' } : { type: 'uuids', uuids: selected.keys() },
    )
      .then(({ updated }) => {
        clear();
        refetch();

        addToast(
          t('pages.admin.databaseAgentTemplates.tabs.instances.page.toast.updated', {
            instances: tItem('instance', updated),
          }),
          'success',
        );
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => {
        setApplying(null);
      });
  };

  const columns = [
    tableSelectionHeader({
      checked: allSelected,
      indeterminate: selected.size > 0 && !allSelected,
      onChange: (checked) => (checked ? selectAll() : clear()),
    }),
    ...databaseAgentTemplateInstanceTableColumns(),
  ];

  return (
    <AdminSubContentContainer
      title={t('pages.admin.databaseAgentTemplates.tabs.instances.page.title', {})}
      titleOrder={2}
      search={search}
      setSearch={setSearch}
      registry={
        window.extensionContext.extensionRegistry.pages.admin.databaseAgentTemplates.view.instances.subContainer
      }
      registryProps={{ databaseAgentTemplate }}
      contentRight={
        <AdminCan action='database-agent-templates.update'>
          <Button
            onClick={() => setPendingScope('all')}
            loading={applying === 'all'}
            disabled={instances?.total === 0 || applying !== null}
          >
            <FontAwesomeIcon icon={faArrowsRotate} className='mr-2' />
            {t('pages.admin.databaseAgentTemplates.tabs.instances.page.button.applyAllUpdates', {})}
          </Button>
        </AdminCan>
      }
    >
      <ConfirmationModal
        opened={pendingScope !== null}
        onClose={() => setPendingScope(null)}
        title={t('pages.admin.databaseAgentTemplates.tabs.instances.page.modal.applyUpdates.title', {})}
        confirm={t('common.button.continue', {})}
        confirmColor='blue'
        onConfirmed={doApplyUpdates}
      >
        {pendingScope === 'all' ? (
          t('pages.admin.databaseAgentTemplates.tabs.instances.page.modal.applyUpdates.contentAll', {
            name: databaseAgentTemplate.name,
          }).md()
        ) : (
          <Stack>
            {t('pages.admin.databaseAgentTemplates.tabs.instances.page.modal.applyUpdates.content', {
              items: tItem('instance', selected.size),
              name: databaseAgentTemplate.name,
            }).md()}

            <ItemPreviewList
              items={selected.values()}
              getKey={(databaseAgent) => databaseAgent.uuid}
              renderItem={(databaseAgent) => (
                <ItemPreviewRow
                  icon={<FontAwesomeIcon icon={faDatabase} />}
                  name={databaseAgent.name}
                  description={databaseAgent.server.name}
                  meta={databaseAgentTypeLabelMapping[databaseAgent.type]}
                />
              )}
            />
          </Stack>
        )}
      </ConfirmationModal>

      <ActionBar opened={selected.size > 0}>
        <AdminCan action='database-agent-templates.update'>
          <Button
            onClick={() => setPendingScope('selected')}
            loading={applying === 'selected'}
            disabled={applying !== null}
            className='col-span-2'
          >
            <FontAwesomeIcon icon={faArrowsRotate} className='mr-2' />
            {t('pages.admin.databaseAgentTemplates.tabs.instances.page.button.applyUpdates', {})}
          </Button>
        </AdminCan>
      </ActionBar>

      <SelectionArea onSelectedStart={selectionAreaProps.onSelectedStart} onSelected={selectionAreaProps.onSelected}>
        <Table
          columns={columns}
          loading={loading}
          error={error}
          pagination={instances}
          onPageSelect={setPage}
          onPerPageSelect={setPerPage}
        >
          {instances?.data.map((databaseAgent) => (
            <SelectionArea.Selectable key={databaseAgent.uuid} item={databaseAgent}>
              {(innerRef: Ref<HTMLElement>) => (
                <DatabaseAgentTemplateInstanceRow
                  key={databaseAgent.uuid}
                  databaseAgent={databaseAgent}
                  isSelected={selected.has(databaseAgent.uuid)}
                  onSelectionChange={(isSelected, range) => toggle(databaseAgent, isSelected, range)}
                  ref={innerRef as Ref<HTMLTableRowElement>}
                />
              )}
            </SelectionArea.Selectable>
          ))}
        </Table>
      </SelectionArea>
    </AdminSubContentContainer>
  );
}
