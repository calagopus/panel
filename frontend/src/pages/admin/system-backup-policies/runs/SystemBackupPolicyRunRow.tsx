import { faBan, faListCheck } from '@fortawesome/free-solid-svg-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';
import cancelSystemBackupPolicyRun from '@/api/admin/system-backup-policies/runs/cancelSystemBackupPolicyRun.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Badge from '@/elements/data-display/Badge.tsx';
import { TableData, TableRow } from '@/elements/data-display/Table.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/overlays/ContextMenu.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import {
  getSystemBackupPolicyRunState,
  isSystemBackupPolicyRunCancellable,
  systemBackupPolicyRunStateInfo,
} from '@/lib/domain/systemBackupPolicyRun.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import {
  adminSystemBackupPolicyRunSchema,
  adminSystemBackupPolicySchema,
} from '@/lib/schemas/admin/systemBackupPolicies.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import SystemBackupPolicyRunTargetsModal from './modals/SystemBackupPolicyRunTargetsModal.tsx';
import SystemBackupPolicyRunProgress from './SystemBackupPolicyRunProgress.tsx';

export default function SystemBackupPolicyRunRow({
  systemBackupPolicy,
  run,
}: {
  systemBackupPolicy: z.infer<typeof adminSystemBackupPolicySchema>;
  run: z.infer<typeof adminSystemBackupPolicyRunSchema>;
}) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const canUpdate = useAdminCan('system-backup-policies.update');
  const [openModal, setOpenModal] = useState<'targets' | 'cancel' | null>(null);

  const state = systemBackupPolicyRunStateInfo[getSystemBackupPolicyRunState(run)];

  const doCancel = async () => {
    await cancelSystemBackupPolicyRun(systemBackupPolicy.uuid, run.uuid)
      .then(() => {
        setOpenModal(null);
        addToast(t('pages.admin.systemBackupPolicies.tabs.runs.page.toast.cancelled', {}), 'success');
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.systemBackupPolicies.latestRuns() });
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.systemBackupPolicies.runs(systemBackupPolicy.uuid) });
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  return (
    <>
      <SystemBackupPolicyRunTargetsModal
        systemBackupPolicy={systemBackupPolicy}
        run={run}
        opened={openModal === 'targets'}
        onClose={() => setOpenModal(null)}
        onCancelRun={() => setOpenModal('cancel')}
      />
      <ConfirmationModal
        opened={openModal === 'cancel'}
        onClose={() => setOpenModal(null)}
        title={t('pages.admin.systemBackupPolicies.tabs.runs.page.modal.cancel.title', {})}
        confirm={t('pages.admin.systemBackupPolicies.tabs.runs.page.button.cancelRun', {})}
        onConfirmed={doCancel}
      >
        {t('pages.admin.systemBackupPolicies.tabs.runs.page.modal.cancel.content', {
          pending: run.pendingTargets,
        }).md()}
      </ConfirmationModal>

      <ContextMenu
        items={[
          {
            type: 'action',
            icon: faListCheck,
            label: t('pages.admin.systemBackupPolicies.tabs.runs.page.button.viewTargets', {}),
            onClick: () => setOpenModal('targets'),
            color: 'gray',
          },
          {
            type: 'action',
            icon: faBan,
            label: t('pages.admin.systemBackupPolicies.tabs.runs.page.button.cancelRun', {}),
            hidden: !isSystemBackupPolicyRunCancellable(run),
            onClick: () => setOpenModal('cancel'),
            color: 'red',
            canAccess: canUpdate,
          },
        ]}
        registry={window.extensionContext.extensionRegistry.pages.admin.systemBackupPolicies.view.runs.contextMenu}
        registryProps={{ systemBackupPolicy, run }}
      >
        {({ items, openMenu }) => (
          <TableRow
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(e.clientX, e.clientY);
            }}
          >
            <TableData>
              <FormattedTimestamp timestamp={run.created} />
            </TableData>
            <TableData>
              <Badge color={run.manual ? 'violet' : 'gray'} variant='light'>
                {run.manual
                  ? t('pages.admin.systemBackupPolicies.tabs.runs.page.badge.manual', {})
                  : t('pages.admin.systemBackupPolicies.tabs.runs.page.badge.scheduled', {})}
              </Badge>
            </TableData>
            <TableData>
              <Badge color={state.badgeColor}>{state.label()}</Badge>
            </TableData>
            <TableData>
              <SystemBackupPolicyRunProgress run={run} />
            </TableData>
            <TableData>{run.completed && <FormattedTimestamp timestamp={run.completed} />}</TableData>

            <ContextMenuToggle items={items} openMenu={openMenu} />
          </TableRow>
        )}
      </ContextMenu>
    </>
  );
}
