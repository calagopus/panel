import { z } from 'zod';
import getTeamPresets from '@/api/admin/teams/presets/getTeamPresets.ts';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table from '@/elements/data-display/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminTeamSchema } from '@/lib/schemas/admin/teams.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import AdminTeamPresetRow from './AdminTeamPresetRow.tsx';

export default function AdminTeamPresets({ team }: { team: z.infer<typeof adminTeamSchema> }) {
  const { t } = useTranslations();

  const {
    data: presets,
    loading,
    error,
    search,
    setSearch,
    setPage,
    setPerPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.teams.presets(team.uuid),
    fetcher: (page, search, perPage) => getTeamPresets(team.uuid, page, search, perPage),
  });

  return (
    <AdminSubContentContainer
      title={t('pages.admin.teams.tabs.presets.page.title', {})}
      titleOrder={2}
      search={search}
      setSearch={setSearch}
      registry={window.extensionContext.extensionRegistry.pages.admin.teams.view.presets.subContainer}
      registryProps={{ team }}
    >
      <Table
        columns={[
          t('common.table.columns.name', {}),
          t('pages.account.teams.table.columns.weight', {}),
          t('pages.server.subusers.table.columns.permissions', {}),
          t('pages.server.subusers.table.columns.ignoredFiles', {}),
        ]}
        loading={loading}
        pagination={presets}
        onPageSelect={setPage}
        onPerPageSelect={setPerPage}
        error={error}
      >
        {presets?.data.map((preset) => (
          <AdminTeamPresetRow key={preset.uuid} preset={preset} />
        ))}
      </Table>
    </AdminSubContentContainer>
  );
}
