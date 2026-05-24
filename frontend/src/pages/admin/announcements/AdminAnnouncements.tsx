import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Route, Routes, useNavigate } from 'react-router';
import getAnnouncements from '@/api/admin/announcements/getAnnouncements.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { announcementTableColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import AdminPermissionGuard from '@/routers/guards/AdminPermissionGuard.tsx';
import AnnouncementCreateOrUpdate from './AnnouncementCreateOrUpdate.tsx';
import AnnouncementRow from './AnnouncementRow.tsx';
import AnnouncementView from './AnnouncementView.tsx';

function AnnouncementsContainer() {
  const navigate = useNavigate();

  const {
    data: announcements,
    loading,
    search,
    setSearch,
    setPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.announcements.all(),
    fetcher: getAnnouncements,
  });

  return (
    <AdminContentContainer
      title='Announcements'
      search={search}
      setSearch={setSearch}
      contentRight={
        <AdminCan action='announcements.create'>
          <Button
            onClick={() => navigate('/admin/announcements/new')}
            color='blue'
            leftSection={<FontAwesomeIcon icon={faPlus} />}
          >
            Create
          </Button>
        </AdminCan>
      }
    >
      <Table columns={announcementTableColumns} loading={loading} pagination={announcements} onPageSelect={setPage}>
        {announcements?.data.map((announcement) => (
          <AnnouncementRow key={announcement.uuid} announcement={announcement} />
        ))}
      </Table>
    </AdminContentContainer>
  );
}

export default function AdminAnnouncements() {
  return (
    <Routes>
      <Route path='/' element={<AnnouncementsContainer />} />
      <Route path='/:id/*' element={<AnnouncementView />} />
      <Route element={<AdminPermissionGuard permission='announcements.create' />}>
        <Route path='/new' element={<AnnouncementCreateOrUpdate />} />
      </Route>
    </Routes>
  );
}
