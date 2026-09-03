import { faRightFromBracket } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { httpErrorToHuman } from '@/api/axios.ts';
import deleteSessions from '@/api/me/sessions/deleteSessions.ts';
import getSessions from '@/api/me/sessions/getSessions.ts';
import Button from '@/elements/buttons/Button.tsx';
import AccountContentContainer from '@/elements/containers/AccountContentContainer.tsx';
import Table from '@/elements/data-display/Table.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import ConditionalTooltip from '@/elements/overlays/ConditionalTooltip.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import SessionRow from './SessionRow.tsx';

export default function DashboardSessions() {
  const { t, tItem } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [openModal, setOpenModal] = useState<'deleteOthers' | null>(null);

  const {
    data: sessions,
    loading,
    error,
    search,
    setSearch,
    setPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.user.sessions.all(),
    fetcher: getSessions,
  });

  const hasOtherSessions = sessions?.data.some((session) => !session.isUsing) ?? false;

  const doDeleteOthers = async () => {
    await deleteSessions()
      .then(({ deleted }) => {
        setOpenModal(null);
        queryClient.invalidateQueries({ queryKey: queryKeys.user.sessions.all() });
        addToast(
          t('pages.account.sessions.modal.deleteOtherSessions.toast.deleted', {
            sessions: tItem('session', deleted),
          }),
          'success',
        );
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  return (
    <AccountContentContainer
      title={t('pages.account.sessions.title', {})}
      search={search}
      setSearch={setSearch}
      contentRight={
        <ConditionalTooltip enabled={!hasOtherSessions} label={t('pages.account.sessions.tooltip.noOtherSessions', {})}>
          <Button
            onClick={() => setOpenModal('deleteOthers')}
            color='red'
            disabled={!hasOtherSessions}
            leftSection={<FontAwesomeIcon icon={faRightFromBracket} />}
          >
            {t('pages.account.sessions.button.deleteOthers', {})}
          </Button>
        </ConditionalTooltip>
      }
      registry={window.extensionContext.extensionRegistry.pages.dashboard.sessions.container}
    >
      <ConfirmationModal
        opened={openModal === 'deleteOthers'}
        onClose={() => setOpenModal(null)}
        title={t('pages.account.sessions.modal.deleteOtherSessions.title', {})}
        confirm={t('pages.account.sessions.button.deleteOthers', {})}
        onConfirmed={doDeleteOthers}
      >
        {t('pages.account.sessions.modal.deleteOtherSessions.content', {}).md()}
      </ConfirmationModal>

      <Table
        columns={[
          t('common.table.columns.ip', {}),
          t('pages.account.sessions.table.columns.thisDevice', {}),
          t('pages.account.sessions.table.columns.userAgent', {}),
          t('common.table.columns.lastUsed', {}),
          '',
        ]}
        loading={loading}
        pagination={sessions}
        onPageSelect={setPage}
        error={error}
      >
        {sessions?.data.map((session) => (
          <SessionRow key={session.uuid} session={session} />
        ))}
      </Table>
    </AccountContentContainer>
  );
}
