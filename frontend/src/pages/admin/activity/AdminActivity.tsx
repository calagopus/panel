import { faX } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import getAdminActivity from '@/api/admin/getAdminActivity.ts';
import Button from '@/elements/Button.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminActivityColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import ActivityRow from './ActivityRow.tsx';

export default function AdminActivity() {
  const { t } = useTranslations();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filterUserUuid, setFilterUserUuid] = useState<string | null>(null);

  useEffect(() => {
    if (filterUserUuid) {
      setSearchParams((prev) => {
        prev.set('user', filterUserUuid);
        return prev;
      });
    } else {
      setSearchParams((prev) => {
        prev.delete('user');
        return prev;
      });
    }
  }, [filterUserUuid, setSearchParams]);

  useEffect(() => {
    const userUuid = searchParams.get('user');
    if (userUuid) {
      setFilterUserUuid(userUuid);
    }
  }, [searchParams, setSearchParams]);

  const {
    data: activities,
    loading,
    search,
    setSearch,
    setPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.activity.all(filterUserUuid),
    fetcher: (page, search) => getAdminActivity(filterUserUuid, page, search),
  });

  return (
    <AdminContentContainer
      title='Activity'
      search={search}
      setSearch={setSearch}
      contentRight={
        filterUserUuid ? (
          <Button onClick={() => setFilterUserUuid(null)} color='gray' leftSection={<FontAwesomeIcon icon={faX} />}>
            {t('pages.server.activity.button.clearUserFilter', {})}
          </Button>
        ) : null
      }
    >
      <Table columns={adminActivityColumns} loading={loading} pagination={activities} onPageSelect={setPage}>
        {activities?.data.map((activity) => (
          <ActivityRow key={activity.created.toString()} activity={activity} />
        ))}
      </Table>
    </AdminContentContainer>
  );
}
