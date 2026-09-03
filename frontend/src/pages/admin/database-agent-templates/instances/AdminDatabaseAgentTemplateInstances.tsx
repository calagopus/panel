import { faArrowsRotate } from '@fortawesome/free-solid-svg-icons';
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
import Table from '@/elements/data-display/Table.tsx';
import SelectionArea from '@/elements/dnd/SelectionArea.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminDatabaseAgentTemplateSchema } from '@/lib/schemas/admin/databaseAgentTemplates.ts';
import { databaseAgentTemplateInstanceTableColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useObjectSetSelection } from '@/plugins/selection/useObjectSetSelection.ts';
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
    refetch,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.databaseInstances.byTemplate(databaseAgentTemplate.uuid),
    fetcher: (page, search) => getDatabaseAgentTemplateInstances(databaseAgentTemplate.uuid, page, search),
  });

  const { selected, add, remove, clear, selectionAreaProps } = useObjectSetSelection(instances?.data);

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

  const columns = ['', ...databaseAgentTemplateInstanceTableColumns()];

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
        {pendingScope === 'all'
          ? t('pages.admin.databaseAgentTemplates.tabs.instances.page.modal.applyUpdates.contentAll', {
              name: databaseAgentTemplate.name,
            }).md()
          : t('pages.admin.databaseAgentTemplates.tabs.instances.page.modal.applyUpdates.content', {
              count: selected.size,
              name: databaseAgentTemplate.name,
            }).md()}
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
          allowSelect={false}
        >
          {instances?.data.map((databaseAgent) => (
            <SelectionArea.Selectable key={databaseAgent.uuid} item={databaseAgent}>
              {(innerRef: Ref<HTMLElement>) => (
                <DatabaseAgentTemplateInstanceRow
                  key={databaseAgent.uuid}
                  databaseAgent={databaseAgent}
                  isSelected={selected.has(databaseAgent.uuid)}
                  onSelectionChange={(isSelected) => (isSelected ? add(databaseAgent) : remove(databaseAgent))}
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
