import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { httpErrorToHuman } from '@/api/axios.ts';
import createAllocation from '@/api/server/allocations/createAllocation.ts';
import getAllocations from '@/api/server/allocations/getAllocations.ts';
import Button from '@/elements/Button.tsx';
import { ServerCan } from '@/elements/Can.tsx';
import ConditionalTooltip from '@/elements/ConditionalTooltip.tsx';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePaginatedTable.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import AllocationRow from './AllocationRow.tsx';

export default function ServerNetwork() {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { server } = useServerStore();

  const {
    data: allocations,
    loading,
    error,
    search,
    setSearch,
    setPage,
    refetch,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.server(server.uuid).network.all(),
    fetcher: (page, search) => getAllocations(server.uuid, page, search),
  });

  const doAdd = () => {
    createAllocation(server.uuid)
      .then(() => {
        refetch();
        addToast(t('pages.server.network.toast.created', {}), 'success');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  return (
    <ServerContentContainer
      title={t('pages.server.network.title', {})}
      subtitle={t('pages.server.network.subtitle', {
        current: allocations?.total ?? 0,
        max: server.featureLimits.allocations,
      })}
      search={search}
      setSearch={setSearch}
      contentRight={
        <ServerCan action='allocations.create'>
          <ConditionalTooltip
            enabled={(allocations?.total ?? 0) >= server.featureLimits.allocations}
            label={t('pages.server.network.tooltip.limitReached', { max: server.featureLimits.allocations })}
          >
            <Button
              disabled={(allocations?.total ?? 0) >= server.featureLimits.allocations}
              onClick={doAdd}
              color='blue'
              leftSection={<FontAwesomeIcon icon={faPlus} />}
            >
              {t('common.button.add', {})}
            </Button>
          </ConditionalTooltip>
        </ServerCan>
      }
      registry={window.extensionContext.extensionRegistry.pages.server.network.container}
    >
      <Table
        columns={[
          '',
          t('pages.server.network.table.columns.hostname', {}),
          t('pages.server.network.table.columns.port', {}),
          t('common.table.columns.notes', {}),
          t('common.table.columns.created', {}),
          '',
        ]}
        loading={loading}
        pagination={allocations}
        onPageSelect={setPage}
        error={error}
      >
        {allocations?.data.map((allocation) => (
          <AllocationRow key={allocation.uuid} allocation={allocation} />
        ))}
      </Table>
    </ServerContentContainer>
  );
}
