import { faArrowsRotate } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Ref, useState } from 'react';
import { z } from 'zod';
import getDatabaseAgentTemplateInstances from '@/api/admin/database-agent-templates/getDatabaseAgentTemplateInstances.ts';
import updateDatabaseAgentTemplateInstances from '@/api/admin/database-agent-templates/updateDatabaseAgentTemplateInstances.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import ActionBar from '@/elements/ActionBar.tsx';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import SelectionArea from '@/elements/SelectionArea.tsx';
import Table from '@/elements/Table.tsx';
import { ObjectSet } from '@/lib/objectSet.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminDatabaseAgentTemplateSchema } from '@/lib/schemas/admin/databaseAgentTemplates.ts';
import { adminServerDatabaseAgentSchema } from '@/lib/schemas/admin/servers.ts';
import { databaseAgentTemplateInstanceTableColumns } from '@/lib/tableColumns.ts';
import { useKeyboardShortcuts } from '@/plugins/useKeyboardShortcuts.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePaginatedTable.ts';
import { useSelectionArea } from '@/plugins/useSelectionArea.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import DatabaseAgentRow from './DatabaseAgentRow.tsx';

export default function AdminDatabaseAgentTemplateInstances({
  databaseAgentTemplate,
}: {
  databaseAgentTemplate: z.infer<typeof adminDatabaseAgentTemplateSchema>;
}) {
  const { t, tItem } = useTranslations();
  const { addToast } = useToast();

  const [applyUpdatesScope, setApplyUpdatesScope] = useState<'selected' | 'all' | null>(null);
  const [applyingAll, setApplyingAll] = useState(false);
  const [selectedInstances, setSelectedInstances] = useState(
    new ObjectSet<z.infer<typeof adminServerDatabaseAgentSchema>, 'uuid'>('uuid'),
  );

  const {
    data: instances,
    loading,
    error,
    refetch,
    search,
    setSearch,
    setPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.databaseAgentTemplates.instances(databaseAgentTemplate.uuid),
    fetcher: (page, search) => getDatabaseAgentTemplateInstances(databaseAgentTemplate.uuid, page, search),
  });

  const { onSelectedStart, onSelected } = useSelectionArea({
    identify: (instance) => instance.uuid,
    getSelected: () => selectedInstances.values(),
    setSelected: (instances) => setSelectedInstances(new ObjectSet('uuid', instances)),
  });

  const addSelectedInstance = (instance: z.infer<typeof adminServerDatabaseAgentSchema>) =>
    setSelectedInstances((prev) => prev.clone().add(instance));

  const removeSelectedInstance = (instance: z.infer<typeof adminServerDatabaseAgentSchema>) =>
    setSelectedInstances((prev) => {
      const next = prev.clone();
      next.delete(instance);
      return next;
    });

  useKeyboardShortcuts({
    shortcuts: [
      {
        key: 'a',
        modifiers: ['ctrlOrMeta'],
        callback: () => setSelectedInstances(new ObjectSet('uuid', instances?.data)),
      },
      {
        key: 'Escape',
        callback: () => setSelectedInstances(new ObjectSet('uuid')),
      },
    ],
    deps: [instances],
  });

  const doApplyUpdates = async () => {
    const all = applyUpdatesScope === 'all';
    setApplyUpdatesScope(null);
    if (all) {
      setApplyingAll(true);
    }

    await updateDatabaseAgentTemplateInstances(databaseAgentTemplate.uuid, all ? [] : selectedInstances.keys())
      .then(({ updated }) => {
        setSelectedInstances(new ObjectSet('uuid'));
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
        setApplyingAll(false);
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
          <Button onClick={() => setApplyUpdatesScope('all')} loading={applyingAll} disabled={instances?.total === 0}>
            <FontAwesomeIcon icon={faArrowsRotate} className='mr-2' />
            {t('pages.admin.databaseAgentTemplates.tabs.instances.page.button.applyAllUpdates', {})}
          </Button>
        </AdminCan>
      }
    >
      <ConfirmationModal
        opened={applyUpdatesScope !== null}
        onClose={() => setApplyUpdatesScope(null)}
        title={t('pages.admin.databaseAgentTemplates.tabs.instances.page.modal.applyUpdates.title', {})}
        confirm={t('common.button.continue', {})}
        confirmColor='blue'
        onConfirmed={doApplyUpdates}
      >
        {applyUpdatesScope === 'all'
          ? t('pages.admin.databaseAgentTemplates.tabs.instances.page.modal.applyUpdates.contentAll', {
              name: databaseAgentTemplate.name,
            }).md()
          : t('pages.admin.databaseAgentTemplates.tabs.instances.page.modal.applyUpdates.content', {
              count: selectedInstances.size,
              name: databaseAgentTemplate.name,
            }).md()}
      </ConfirmationModal>

      <ActionBar opened={selectedInstances.size > 0}>
        <AdminCan action='database-agent-templates.update'>
          <Button onClick={() => setApplyUpdatesScope('selected')} className='col-span-2'>
            <FontAwesomeIcon icon={faArrowsRotate} className='mr-2' />
            {t('pages.admin.databaseAgentTemplates.tabs.instances.page.button.applyUpdates', {})}
          </Button>
        </AdminCan>
      </ActionBar>

      <SelectionArea onSelectedStart={onSelectedStart} onSelected={onSelected}>
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
                <DatabaseAgentRow
                  key={databaseAgent.uuid}
                  databaseAgent={databaseAgent}
                  isSelected={selectedInstances.has(databaseAgent.uuid)}
                  onSelectionChange={(selected) =>
                    selected ? addSelectedInstance(databaseAgent) : removeSelectedInstance(databaseAgent)
                  }
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
