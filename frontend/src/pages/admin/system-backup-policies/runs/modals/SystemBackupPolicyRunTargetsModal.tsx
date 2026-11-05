import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ModalProps, Text } from '@mantine/core';
import { useState } from 'react';
import { z } from 'zod';
import getSystemBackupPolicyRunTargets from '@/api/admin/system-backup-policies/runs/getSystemBackupPolicyRunTargets.ts';
import Button from '@/elements/buttons/Button.tsx';
import Badge from '@/elements/data-display/Badge.tsx';
import Table from '@/elements/data-display/Table.tsx';
import Select from '@/elements/input/Select.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import {
  getSystemBackupPolicyRunState,
  isSystemBackupPolicyRunCancellable,
  systemBackupPolicyRunStateInfo,
} from '@/lib/domain/systemBackupPolicyRun.ts';
import { mappingToSelectData, systemBackupPolicyRunTargetStatusLabelMapping } from '@/lib/enums.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import {
  adminSystemBackupPolicyRunSchema,
  adminSystemBackupPolicySchema,
  systemBackupPolicyRunTargetStatus,
} from '@/lib/schemas/admin/systemBackupPolicies.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import SystemBackupPolicyRunProgress from '../SystemBackupPolicyRunProgress.tsx';
import SystemBackupPolicyRunTargetRow from '../SystemBackupPolicyRunTargetRow.tsx';

export default function SystemBackupPolicyRunTargetsModal({
  systemBackupPolicy,
  run,
  onCancelRun,
  ...props
}: ModalProps & {
  systemBackupPolicy: z.infer<typeof adminSystemBackupPolicySchema>;
  run: z.infer<typeof adminSystemBackupPolicyRunSchema>;
  onCancelRun: () => void;
}) {
  const { t } = useTranslations();
  const canUpdate = useAdminCan('system-backup-policies.update');
  const [status, setStatus] = useState<z.infer<typeof systemBackupPolicyRunTargetStatus> | null>(null);

  const {
    data: targets,
    loading,
    error,
    search,
    setSearch,
    setPage,
    setPerPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.systemBackupPolicies.runTargets(systemBackupPolicy.uuid, run.uuid),
    fetcher: (page, search, perPage) =>
      getSystemBackupPolicyRunTargets(systemBackupPolicy.uuid, run.uuid, page, search, status, perPage),
    deps: [status],
    modifyParams: false,
    canRequest: props.opened,
    refetchInterval: run.completed ? false : 5000,
  });

  const isDatabaseKind = systemBackupPolicy.kind === 'database_instance';
  const state = systemBackupPolicyRunStateInfo[getSystemBackupPolicyRunState(run)];

  return (
    <Modal title={t('pages.admin.systemBackupPolicies.tabs.runs.page.modal.targets.title', {})} size='xl' {...props}>
      <Stack>
        <Group justify='space-between'>
          <Group gap='xs'>
            <Badge color={state.badgeColor}>{state.label()}</Badge>
            <Badge color={run.manual ? 'violet' : 'gray'} variant='light'>
              {run.manual
                ? t('pages.admin.systemBackupPolicies.tabs.runs.page.badge.manual', {})
                : t('pages.admin.systemBackupPolicies.tabs.runs.page.badge.scheduled', {})}
            </Badge>
          </Group>
          <Text size='sm' c='dimmed'>
            <FormattedTimestamp timestamp={run.created} />
          </Text>
        </Group>

        <SystemBackupPolicyRunProgress run={run} />

        <Group grow>
          <TextInput
            placeholder={t('common.input.search', {})}
            leftSection={<FontAwesomeIcon icon={faMagnifyingGlass} size='sm' />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
          />
          <Select
            placeholder={t('pages.admin.systemBackupPolicies.tabs.runs.page.modal.targets.allStatuses', {})}
            data={mappingToSelectData(systemBackupPolicyRunTargetStatusLabelMapping)}
            value={status}
            onChange={(value) => setStatus(value as z.infer<typeof systemBackupPolicyRunTargetStatus> | null)}
            allowDeselect
            clearable
          />
        </Group>

        <Table
          columns={[
            ...(isDatabaseKind ? [t('common.table.columns.source', {})] : []),
            t('common.table.columns.server', {}),
            t('common.table.columns.node', {}),
            t('common.table.columns.status', {}),
            t('pages.admin.systemBackupPolicies.tabs.runs.page.table.columns.reason', {}),
            t('common.table.columns.updated', {}),
          ]}
          loading={loading}
          error={error}
          pagination={targets}
          onPageSelect={setPage}
          onPerPageSelect={setPerPage}
        >
          {targets?.data.map((target) => (
            <SystemBackupPolicyRunTargetRow key={target.uuid} target={target} showSource={isDatabaseKind} />
          ))}
        </Table>
      </Stack>

      <ModalFooter>
        {canUpdate && isSystemBackupPolicyRunCancellable(run) && (
          <Button color='red' onClick={onCancelRun}>
            {t('pages.admin.systemBackupPolicies.tabs.runs.page.button.cancelRun', {})}
          </Button>
        )}
        <Button variant='default' onClick={props.onClose}>
          {t('common.button.close', {})}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
