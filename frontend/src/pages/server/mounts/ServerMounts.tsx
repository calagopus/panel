import { z } from 'zod';
import { getEmptyPaginationSet } from '@/api/axios.ts';
import getMounts from '@/api/server/mounts/getMounts.ts';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverMountSchema } from '@/lib/schemas/server/mounts.ts';
import { MountRow } from '@/pages/server/mounts/MountRow.tsx';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function ServerMounts() {
  const { t } = useTranslations();
  const server = useServerStore((state) => state.server);

  const { data, loading } = useSearchablePaginatedTable({
    queryKey: queryKeys.server(server.uuid).mounts.all(),
    fetcher: () => getMounts(server.uuid),
  });

  const mounts = data ?? getEmptyPaginationSet<z.infer<typeof serverMountSchema>>();

  return (
    <ServerContentContainer
      title={t('pages.server.mounts.title', {})}
      registry={window.extensionContext.extensionRegistry.pages.server.mounts.container}
    >
      <Table
        columns={[
          t('common.table.columns.name', {}),
          t('common.table.columns.description', {}),
          t('pages.server.mounts.table.columns.target', {}),
          t('pages.server.mounts.table.columns.mounted', {}),
          t('pages.server.mounts.table.columns.readOnly', {}),
          '',
        ]}
        loading={loading}
        pagination={mounts}
      >
        {mounts.data.map((mount) => (
          <MountRow key={mount.uuid} contextMount={mount} />
        ))}
      </Table>
    </ServerContentContainer>
  );
}
